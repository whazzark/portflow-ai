import { ResourceCollectionError } from '@/components/resource/resource-feedback'

export function WarehousesError({ onRetry }: { onRetry: () => void }) {
  return <ResourceCollectionError label="warehouses" onRetry={onRetry} />
}
