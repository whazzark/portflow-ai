import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { fromLegacyTransportCompanySearch } from '@/features/transport-resources/helpers/transport-resources-search'

const legacyTransportCompanySearchSchema = z.object({
  status: z.enum(['available', 'archived']).catch('available'),
  search: z.string().catch(''),
  transportCompanyId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/transport-companies')({
  validateSearch: legacyTransportCompanySearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/transport-resources',
      replace: true,
      search: fromLegacyTransportCompanySearch(search),
    })
  },
})
