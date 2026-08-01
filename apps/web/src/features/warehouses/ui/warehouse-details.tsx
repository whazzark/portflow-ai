import { ResourceDetailHeader } from '@/components/resource-map/resource-details'
import type { WarehouseDto } from '@/features/warehouses/types'

export function WarehouseDetails({ warehouse }: { warehouse: WarehouseDto }) {
  return (
    <div className="shrink-0">
      <ResourceDetailHeader name={warehouse.name} status={warehouse.status} />
    </div>
  )
}
