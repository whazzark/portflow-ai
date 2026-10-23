import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { isAdministrator } from '@/features/auth/policies/permissions'
import {
  DEFAULT_TRANSPORT_RESOURCES_SEARCH,
  transportResourcesSearchSchema,
} from '@/features/transport-resources/helpers/transport-resources-search'
import { TransportResourcesPage } from '@/features/transport-resources/ui/transport-resources-page'
import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { TrucksError } from '@/features/trucks/ui/trucks-error'
import { TrucksPending } from '@/features/trucks/ui/trucks-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated/transport-resources')({
  staticData: { breadcrumb: 'Transport resources' },
  validateSearch: transportResourcesSearchSchema,
  search: { middlewares: [stripSearchParams(DEFAULT_TRANSPORT_RESOURCES_SEARCH)] },
  loader: async ({ context: { queryClient } }) => {
    const session = await ensureSessionUser(queryClient)
    // Transport companies are intentionally not ensured here: the page owns their loading and
    // error state, and pre-fetching them would route a companies-specific failure into this
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
