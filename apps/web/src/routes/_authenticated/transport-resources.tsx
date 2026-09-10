import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { isAdministrator } from '@/features/auth/policies/permissions'
import { TransportResourcesPage } from '@/features/transport-resources/ui/transport-resources-page'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { TrucksError } from '@/features/trucks/ui/trucks-error'
import { TrucksPending } from '@/features/trucks/ui/trucks-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

const transportResourcesSearchSchema = z
  .object({
    companyStatus: z.enum(['available', 'archived']).catch('available'),
    companySearch: z.string().catch(''),
    transportCompanyId: z.string().optional().catch(undefined),
    companyDetailsId: z.string().optional().catch(undefined),
    companyDetailsMode: z.enum(['view', 'edit', 'create']).catch('view'),
    truckStatus: z.enum(['available', 'suspended', 'archived']).catch('available'),
    truckSearch: z.string().catch(''),
    truckId: z.string().optional().catch(undefined),
    truckMode: z.enum(['view', 'edit', 'create']).catch('view'),
  })
  // Creating a resource and detailing one are mutually exclusive states, for a truck exactly as
  // for a company. Clearing the id here means the two can never contradict each other, so no
  // consumer has to decide which one wins.
  .transform((search) => ({
    ...search,
    companyDetailsId: search.companyDetailsMode === 'create' ? undefined : search.companyDetailsId,
    truckId: search.truckMode === 'create' ? undefined : search.truckId,
  }))

export const Route = createFileRoute('/_authenticated/transport-resources')({
  staticData: { breadcrumb: 'Transport resources' },
  validateSearch: transportResourcesSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    const session = await ensureSessionUser(queryClient)
    // Transport companies are intentionally not ensured here: both TrucksPage and
    // TransportResourcesWorkspace already own their own loading/error UI for that
    // query, and pre-fetching it would route a companies-specific failure into this
    // truck-labeled error boundary instead.
    if (isAdministrator(session.data)) {
      return queryClient.ensureQueryData(truckQueries.all())
    }

    // A non-administrator reads two collections: the trucks on offer, and the suspended ones
    // that explain why a truck they were using is no longer among them.
    return Promise.all([
      queryClient.ensureQueryData(truckQueries.available()),
      queryClient.ensureQueryData(truckQueries.suspended()),
    ])
  },
  pendingComponent: TrucksPending,
  errorComponent: TrucksError,
  component: TransportResourcesPage,
})
