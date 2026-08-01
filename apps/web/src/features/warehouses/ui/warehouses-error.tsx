import { ResourceMapError } from '@/components/resource-map/resource-map-feedback'

export function WarehousesError({ onRetry }: { onRetry: () => void }) {
  return <ResourceMapError label="warehouses" onRetry={onRetry} />
}
