import { createFileRoute } from '@tanstack/react-router'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DischargesError } from '@/features/discharges/ui/discharges-error'
import { DischargesPage } from '@/features/discharges/ui/discharges-page'
import { DischargesPending } from '@/features/discharges/ui/discharges-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated/discharges/')({
  loader: async ({ context: { queryClient } }) => {
    await ensureSessionUser(queryClient)

    // One read serves all three tabs and all three counts, so switching status never refetches.
    return queryClient.ensureQueryData(dischargeQueries.all())
  },
  pendingComponent: DischargesPending,
  errorComponent: DischargesError,
  component: DischargesPage,
})
