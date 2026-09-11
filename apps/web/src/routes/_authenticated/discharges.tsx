import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { DISCHARGE_STATUS_FILTERS } from '@/features/discharges/types'

// The layout owns the list's state rather than the list itself: a discharge's detail is a child
// of this route, so it inherits the status and search it was opened from, and its way back
// restores exactly that collection. Opened on its own, the defaults land it on the Active list.
const dischargesSearchSchema = z.object({
  search: z.string().catch(''),
  status: z.enum(DISCHARGE_STATUS_FILTERS).catch('active'),
})

export const Route = createFileRoute('/_authenticated/discharges')({
  staticData: { breadcrumb: 'Discharges' },
  validateSearch: dischargesSearchSchema,
})
