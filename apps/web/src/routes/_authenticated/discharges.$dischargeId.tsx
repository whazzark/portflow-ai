import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DISCHARGE_DETAIL_TABS } from '@/features/discharges/types'
import { DischargeBreadcrumb } from '@/features/discharges/ui/detail/discharge-breadcrumb'
import { DischargeDetailError } from '@/features/discharges/ui/detail/discharge-detail-error'
import { DischargeDetailPage } from '@/features/discharges/ui/detail/discharge-detail-page'
import { DischargeDetailPending } from '@/features/discharges/ui/detail/discharge-detail-pending'
import { DischargeNotFound } from '@/features/discharges/ui/detail/discharge-not-found'
import { isNotFoundError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

// The open section. Optional rather than defaulted, so a link to a discharge never has to name one
// and the overview, the default, stays out of the address.
const dischargeDetailSearchSchema = z.object({
  tab: z.enum(DISCHARGE_DETAIL_TABS).optional().catch(undefined),
  // The shift open on the shifts section. Absent, or naming none of the discharge's shifts, it
  // opens the default one, which is never written to the address.
  shiftId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/discharges/$dischargeId')({
  validateSearch: dischargeDetailSearchSchema,
  staticData: { breadcrumb: DischargeBreadcrumb },
  loader: async ({ context: { queryClient }, params: { dischargeId } }) => {
    await ensureSessionUser(queryClient)

    try {
      return await queryClient.ensureQueryData(dischargeQueries.detail(dischargeId))
    } catch (error) {
      // An address naming no discharge is not a failure a retry could fix, so it takes the
      // not-found path rather than the error component and its retry.
      if (isNotFoundError(error)) {
        throw notFound()
      }

      throw error
    }
  },
  pendingComponent: DischargeDetailPending,
  errorComponent: DischargeDetailError,
  notFoundComponent: DischargeNotFound,
  component: DischargeDetailPage,
})
