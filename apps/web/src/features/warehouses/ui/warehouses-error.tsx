import { ResourceCollectionError } from '@/components/resource-map/resource-map-feedback'

export function WarehousesError({ onRetry }: { onRetry: () => void }) {
  return <ResourceCollectionError label="warehouses" onRetry={onRetry} />
}
