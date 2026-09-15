import { useMutation, useQueryClient } from '@tanstack/react-query'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { parseApiError } from '@/libraries/tuyau/api-error'
import { tuyauQuery } from '@/libraries/tuyau/client'

export const STALE_DETAIL_CODES = new Set([
  'E_DISCHARGE_NOT_PLANNED',
  'E_DISCHARGE_NOT_FOUND',
  'E_PRODUCT_LOT_NOT_FOUND',
  'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS',
])

export function useDischargeMutations() {
  const queryClient = useQueryClient()

  /**
   * Every discharge write answers with the whole detail, so the detail cache takes the answer as
   * it is — its expected tonnage and lot order included — and only the list, which summarizes
   * every discharge, is asked again.
   */
  const applyDetail = async (response: { data: DischargeDetailDto }) => {
    queryClient.setQueryData(dischargeQueries.detail(response.data.id).queryKey, response)
    await queryClient.invalidateQueries({ exact: true, queryKey: dischargeQueries.all().queryKey })
  }

  /**
   * A refusal saying the discharge moved on — it started, or it or its lot is gone — makes the
   * detail on screen stale, so it is fetched again rather than trusted.
   */
  const refreshAfterStaleRefusal = async (error: unknown, dischargeId: string) => {
    if (STALE_DETAIL_CODES.has(parseApiError(error).code ?? '')) {
      await queryClient.invalidateQueries({
        queryKey: dischargeQueries.detail(dischargeId).queryKey,
      })
    }
  }

  const create = useMutation(
    tuyauQuery.discharges.store.mutationOptions({
      onSuccess: (response) => applyDetail(response),
    }),
  )

  const correctIdentity = useMutation(
    tuyauQuery.discharges.update.mutationOptions({
      onSuccess: (response) => applyDetail(response),
      onError: (error, variables) => refreshAfterStaleRefusal(error, String(variables.params.id)),
    }),
  )

  const addLot = useMutation(
    tuyauQuery.discharges.productLots.store.mutationOptions({
      onSuccess: (response) => applyDetail(response),
      onError: (error, variables) =>
        refreshAfterStaleRefusal(error, String(variables.params.dischargeId)),
    }),
  )
  const correctLot = useMutation(
    tuyauQuery.discharges.productLots.update.mutationOptions({
      onSuccess: (response) => applyDetail(response),
      onError: (error, variables) =>
        refreshAfterStaleRefusal(error, String(variables.params.dischargeId)),
    }),
  )
  const removeLot = useMutation(
    tuyauQuery.discharges.productLots.destroy.mutationOptions({
      onSuccess: (response) => applyDetail(response),
      onError: (error, variables) =>
        refreshAfterStaleRefusal(error, String(variables.params.dischargeId)),
    }),
  )

  return { create, correctIdentity, addLot, correctLot, removeLot }
}
