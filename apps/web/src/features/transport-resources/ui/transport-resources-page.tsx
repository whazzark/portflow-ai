import { getRouteApi } from '@tanstack/react-router'

import { TransportCompaniesPage } from '@/features/transport-companies/ui/transport-companies-page'
import { TransportResourcesWorkspace } from '@/features/transport-resources/ui/transport-resources-workspace'
import { TrucksPage } from '@/features/trucks/ui/trucks-page'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TransportResourcesPage() {
  const { resource } = transportResourcesRoute.useSearch()

  return (
    <main className="relative flex flex-col gap-4 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      {resource === 'companies' ? (
        <TransportCompaniesPage />
      ) : resource === 'trucks' ? (
        <TrucksPage />
      ) : (
        <TransportResourcesWorkspace />
      )}
    </main>
  )
}
