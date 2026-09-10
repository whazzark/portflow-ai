import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { DISCHARGE_STATUS_FILTERS } from '@/features/discharges/types'
import { DischargesError } from '@/features/discharges/ui/discharges-error'
import { DischargesPage } from '@/features/discharges/ui/discharges-page'
import { DischargesPending } from '@/features/discharges/ui/discharges-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

// No `dischargeId` and no `mode`: this slice never opens a discharge, so there is no in-progress
// record to restore and nothing for a `transform` to reconcile. GH-58 adds both with the panel
// that gives them meaning.
const dischargesSearchSchema = z.object({
  search: z.string().catch(''),
  status: z.enum(DISCHARGE_STATUS_FILTERS).catch('active'),
})

export const Route = createFileRoute('/_authenticated/discharges')({
  staticData: { breadcrumb: 'Discharges' },
  validateSearch: dischargesSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    await ensureSessionUser(queryClient)

    // One read serves all three tabs and all three counts, so switching status never refetches.
    return queryClient.ensureQueryData(dischargeQueries.all())
  },
  pendingComponent: DischargesPending,
  errorComponent: DischargesError,
  component: DischargesPage,
})
