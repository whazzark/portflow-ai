import { TransportResourcesWorkspace } from '@/features/transport-resources/ui/transport-resources-workspace'

export function TransportResourcesPage() {
  return (
    <main className="relative flex flex-col gap-4 p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      <TransportResourcesWorkspace />
    </main>
  )
}
