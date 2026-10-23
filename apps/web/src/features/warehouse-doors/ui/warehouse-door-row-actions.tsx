import { ResourceRowActions } from '@/components/lifecycle/resource-row-actions'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import {
  WarehouseDoorLifecycleDialog,
  warehouseDoorLifecycleActions,
} from '@/features/warehouse-doors/warehouse-door-lifecycle'
import { formatCoordinates } from '@/features/warehouses/geometry/footprint-centre'
import type { WarehouseStatus } from '@/features/warehouses/types'
import { copyText } from '@/helpers/copy-text'

/**
 * The per-row administration menu for a warehouse door, mirroring `TruckRowActions`.
 *
 * #214 chose this container with an empty `actions` array precisely so archiving (#215) would
 * arrive as an entry beside `Edit` rather than as a restructuring of the Doors panel; reactivation
 * (#216) fills the remaining slot the same way. A row that allows neither renders nothing at all —
 * `ResourceRowActions` drops the whole trigger — which is exactly the "absent, not disabled" rule a
 * door archived with its warehouse needs.
 */
export function WarehouseDoorRowActions({
  door,
  warehouseStatus,
  canAdminister = false,
  onEdit,
  onShowOnMap,
}: {
  door: WarehouseDoorDto
  warehouseStatus: WarehouseStatus
  /** False leaves only the entries that change nothing — Show on map, Copy coordinates — which
   * every viewer gets. */
  canAdminister?: boolean
  onEdit?: (doorId: string) => void
  onShowOnMap?: (doorId: string) => void
}) {
  return (
    <ResourceRowActions
      actions={canAdminister ? warehouseDoorLifecycleActions(door, warehouseStatus) : []}
      // A door is correctable only while both it and its containing warehouse are available —
      // exactly what the API re-decides under lock.
      editable={canAdminister && door.status === 'AVAILABLE' && warehouseStatus === 'AVAILABLE'}
      items={[
        ...(onShowOnMap
          ? [{ key: 'show', label: 'Show on map', onSelect: () => onShowOnMap(door.id) }]
          : []),
        {
          key: 'copy',
          label: 'Copy coordinates',
          onSelect: () => void copyText(formatCoordinates(door), 'Coordinates'),
        },
      ]}
      name={door.name}
      onEdit={onEdit && (() => onEdit(door.id))}
      // A callback rather than an element, so the feature's mutation hooks run inside the dialog
      // and only while one is open: a warehouse can hold dozens of doors, and an idle row must not
      // carry a mutation observer.
      renderDialog={({ action, onClose }) => (
        <WarehouseDoorLifecycleDialog action={action} door={door} onClose={onClose} />
      )}
    />
  )
}
