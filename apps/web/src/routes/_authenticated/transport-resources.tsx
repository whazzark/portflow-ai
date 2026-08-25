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
    truckMode: z.enum(['view', 'edit']).catch('view'),
  })
  // Creating a company and detailing one are mutually exclusive states. Clearing the id here means
  // the two can never contradict each other, so no consumer has to decide which one wins.
  .transform((search) =>
    search.companyDetailsMode === 'create' ? { ...search, companyDetailsId: undefined } : search,
  )

export const Route = createFileRoute('/_authenticated/transport-resources')({
  staticData: { breadcrumb: 'Transport resources' },
  validateSearch: transportResourcesSearchSchema,
  loader: async ({ context: { queryClient } }) => {
    const session = await ensureSessionUser(queryClient)
    const query = isAdministrator(session.data) ? truckQueries.all() : truckQueries.available()

    // Transport companies are intentionally not ensured here: both TrucksPage and
    // TransportResourcesWorkspace already own their own loading/error UI for that
    // query, and pre-fetching it would route a companies-specific failure into this
    // truck-labeled error boundary instead.
    return queryClient.ensureQueryData(query)
  },
  pendingComponent: TrucksPending,
  errorComponent: TrucksError,
  component: TransportResourcesPage,
})
