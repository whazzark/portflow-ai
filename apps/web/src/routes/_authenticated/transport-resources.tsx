import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { isAdministrator } from '@/features/auth/policies/permissions'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { TransportCompaniesError } from '@/features/transport-companies/ui/transport-companies-error'
import { TransportCompaniesPending } from '@/features/transport-companies/ui/transport-companies-pending'
import { TransportResourcesPage } from '@/features/transport-resources/ui/transport-resources-page'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { TrucksError } from '@/features/trucks/ui/trucks-error'
import { TrucksPending } from '@/features/trucks/ui/trucks-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

const transportResourcesSearchSchema = z.object({
  resource: z.enum(['companies', 'trucks', 'workspace']).catch('workspace'),
  companyStatus: z.enum(['available', 'archived']).catch('available'),
  companySearch: z.string().catch(''),
  transportCompanyId: z.string().optional().catch(undefined),
  companyDetailsId: z.string().optional().catch(undefined),
  truckStatus: z.enum(['available', 'archived']).catch('available'),
  truckSearch: z.string().catch(''),
  truckId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/transport-resources')({
  staticData: { breadcrumb: 'Transport resources' },
  validateSearch: transportResourcesSearchSchema,
  loaderDeps: ({ search }) => ({ resource: search.resource }),
  loader: async ({ context: { queryClient }, deps: { resource } }) => {
    if (resource === 'companies') {
      return queryClient.ensureQueryData(transportCompanyQueries.all())
    }

    if (resource === 'trucks') {
      const session = await ensureSessionUser(queryClient)
      const query = isAdministrator(session.data) ? truckQueries.all() : truckQueries.available()

      return Promise.all([
        queryClient.ensureQueryData(query),
        queryClient.ensureQueryData(transportCompanyQueries.all()),
      ])
    }

    const session = await ensureSessionUser(queryClient)
    const query = isAdministrator(session.data) ? truckQueries.all() : truckQueries.available()

    return Promise.all([
      queryClient.ensureQueryData(transportCompanyQueries.all()),
      queryClient.ensureQueryData(query),
    ])
  },
  pendingComponent: TransportResourcesPending,
  errorComponent: TransportResourcesError,
  component: TransportResourcesPage,
})

function TransportResourcesPending() {
  const { resource } = Route.useSearch()

  return resource === 'companies' ? <TransportCompaniesPending /> : <TrucksPending />
}

function TransportResourcesError() {
  const { resource } = Route.useSearch()

  return resource === 'companies' ? <TransportCompaniesError /> : <TrucksError />
}
