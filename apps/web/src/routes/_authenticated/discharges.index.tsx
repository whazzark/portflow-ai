import { createFileRoute } from '@tanstack/react-router'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DischargesError } from '@/features/discharges/ui/discharges-error'
import { DischargesPage } from '@/features/discharges/ui/discharges-page'
import { DischargesPending } from '@/features/discharges/ui/discharges-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated/discharges/')({
  search: {
    middlewares: [
      // Every way back from a discharge keeps the search it was opened with, and the router keeps
      // parameters no route declares. Dropped here, once, the discharge's open section and open
      // shift never reach the list's address, nor the next discharge opened from it.
      ({ search, next }) => {
        const {
          tab: _openSection,
          shiftId: _openShift,
          ...listSearch
        } = next(search) as typeof search & { tab?: unknown; shiftId?: unknown }

        return listSearch
      },
    ],
  },
  loader: async ({ context: { queryClient } }) => {
    await ensureSessionUser(queryClient)

    // One read serves all three tabs and all three counts, so switching status never refetches.
    return queryClient.ensureQueryData(dischargeQueries.all())
  },
  pendingComponent: DischargesPending,
  errorComponent: DischargesError,
  component: DischargesPage,
})
