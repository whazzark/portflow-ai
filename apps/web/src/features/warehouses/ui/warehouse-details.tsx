import {
  ResourceDetailBody,
  ResourceDetailHeader,
} from '@/components/resource-map/resource-details'
import type { WarehouseDto } from '@/features/warehouses/types'

export function WarehouseDetails({ warehouse }: { warehouse: WarehouseDto }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceDetailHeader
        archivedMessage="Archived warehouses are read-only historical references."
        name={warehouse.name}
        status={warehouse.status}
      />
      <ResourceDetailBody>
        <div className="grid gap-2">
          <h3 className="font-medium">Footprint</h3>
          <p className="text-muted-foreground text-sm">
            {warehouse.footprint.points.length} GPS boundary points
          </p>
          <ol className="grid gap-1 font-mono text-muted-foreground text-xs">
            {warehouse.footprint.points.map((point, index) => (
              <li key={`${point.latitude}:${point.longitude}`}>
                {index + 1}. {point.latitude}, {point.longitude}
              </li>
            ))}
          </ol>
        </div>
      </ResourceDetailBody>
    </div>
  )
}
