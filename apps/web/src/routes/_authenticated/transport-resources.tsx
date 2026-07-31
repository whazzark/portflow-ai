import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { TransportCompaniesError } from '@/features/transport-companies/ui/transport-companies-error'
import { TransportCompaniesPage } from '@/features/transport-companies/ui/transport-companies-page'
import { TransportCompaniesPending } from '@/features/transport-companies/ui/transport-companies-pending'

const transportResourcesSearchSchema = z.object({
  companyStatus: z.enum(['available', 'archived']).catch('available'),
  companySearch: z.string().catch(''),
  transportCompanyId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/transport-resources')({
  staticData: { breadcrumb: 'Transport resources' },
  validateSearch: transportResourcesSearchSchema,
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(transportCompanyQueries.all()),
  pendingComponent: TransportCompaniesPending,
  errorComponent: TransportCompaniesError,
  component: TransportCompaniesPage,
})
