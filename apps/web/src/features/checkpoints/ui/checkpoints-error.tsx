import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { ResourceMapError } from '@/components/resource-map/resource-map-feedback'
import { dockQueries } from '@/features/docks/queries/dock-queries'

export function CheckpointsError() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return (
    <ResourceMapError
      label="checkpoints"
      onRetry={async () => {
        queryClient.removeQueries({ queryKey: dockQueries.list().queryKey })
        await router.invalidate()
      }}
    />
  )
}
