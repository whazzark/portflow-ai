import { createFileRoute, notFound } from '@tanstack/react-router'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DischargeDetailError } from '@/features/discharges/ui/detail/discharge-detail-error'
import { DischargeDetailPage } from '@/features/discharges/ui/detail/discharge-detail-page'
import { DischargeDetailPending } from '@/features/discharges/ui/detail/discharge-detail-pending'
import { DischargeNotFound } from '@/features/discharges/ui/detail/discharge-not-found'
import { isNotFoundError } from '@/libraries/tuyau/api-error'
import { ensureSessionUser } from '@/libraries/tuyau/session'

// The shared header hands over the loader data untyped. Until a discharge has been read — while
// pending, or when it is missing or failed — the crumb still needs a label.
function dischargeBreadcrumb(loaderData: unknown) {
  const detail = loaderData as { data?: { vesselName?: string } } | undefined

  return detail?.data?.vesselName ?? 'Discharge'
}

export const Route = createFileRoute('/_authenticated/discharges/$dischargeId')({
  staticData: { breadcrumb: dischargeBreadcrumb },
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
