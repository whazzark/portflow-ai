import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import type { WarehouseStatus } from '@/features/warehouses/types'

/**
 * The per-row administration menu for a warehouse door, mirroring `TruckRowActions`.
 *
 * `actions` is deliberately empty: #214 delivers no lifecycle transition. The menu exists now so
 * that archiving (#215) and reactivating (#216) arrive as entries beside `Edit` rather than as a
 * restructuring of the Doors panel — and so `Edit` never has to move once they do. Until then
 * `ResourceRowActions` renders nothing at all for a row it cannot act on, which is exactly the
 * "absent, not disabled" rule an archived door needs.
 */
export function WarehouseDoorRowActions({
  door,
  warehouseStatus,
  onEdit,
}: {
  door: WarehouseDoorDto
  warehouseStatus: WarehouseStatus
  onEdit?: (doorId: string) => void
}) {
  return (
    <ResourceRowActions
      actions={[]}
      // A door is correctable only while both it and its containing warehouse are available —
      // exactly what the API re-decides under lock.
      editable={door.status === 'AVAILABLE' && warehouseStatus === 'AVAILABLE'}
      name={door.name}
      onEdit={onEdit && (() => onEdit(door.id))}
    />
  )
}
