import type { ResourceMapCreateAction } from '@/components/resource-map/resource-map-create-control'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import type { WarehouseMapPlacement } from '@/features/warehouses/map/warehouse-map'
import type { PresentedWarehouse } from '@/features/warehouses/types'

/** Deterministic coordinates handed out by successive "map clicks", so a drawing test can build a
 * valid three-point footprint without MapLibre. */
export const MOCK_CLICK_POINTS = [
  { latitude: 10.5, longitude: 20.5 },
  { latitude: 11.5, longitude: 21.5 },
  { latitude: 12.5, longitude: 20.5 },
  { latitude: 13.5, longitude: 22.5 },
]

const statusLabel = (status: PresentedWarehouse['status']) =>
  status === 'AVAILABLE' ? 'Available' : 'Archived'

export function WarehouseMap({
  warehouses,
  selected,
  onSelect,
  placement,
  createActions = [],
}: {
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
  onSelect: (warehouse: PresentedWarehouse) => void
  onError?: (error: unknown) => void
  doors?: WarehouseDoorDto[]
  selectedDoorId?: string
  onDoorSelect?: (door: WarehouseDoorDto) => void
  detailsPanelSide?: 'right' | 'bottom'
  placement?: WarehouseMapPlacement
  createActions?: ResourceMapCreateAction[]
}) {
  const isArmed = placement?.armed ?? false
  const points = placement?.points ?? []

  return (
    <section aria-label="Warehouse map">
      {createActions.map((action) => (
        <button key={action.key} onClick={action.onSelect} type="button">
          {action.label}
        </button>
      ))}
      {warehouses.map((warehouse) => (
        <button
          aria-pressed={warehouse.id === selected?.id}
          // While a footprint is being drawn the map swallows clicks, so no warehouse is
          // selectable — mirrors `useResourceMapPlacement` arming the real canvas.
          disabled={isArmed}
          key={warehouse.id}
          onClick={() => onSelect(warehouse)}
          type="button"
        >
          View warehouse {warehouse.name} ({statusLabel(warehouse.status)})
        </button>
      ))}
      {isArmed && !placement?.completed && (
        <button
          onClick={() =>
            placement?.onAddPoint(MOCK_CLICK_POINTS[points.length % MOCK_CLICK_POINTS.length])
          }
          type="button"
        >
          Simulate map click to add footprint point
        </button>
      )}
      {isArmed && !placement?.completed && points.length >= 3 && (
        <button onClick={() => placement?.onComplete()} type="button">
          Simulate clicking the first footprint point
        </button>
      )}
      {isArmed &&
        points.map((point, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: boundary points are positional.
          <div key={`pending-vertex-${index}`}>
            <span data-testid={`pending-vertex-${index}`}>
              {point.latitude}, {point.longitude}
            </span>
            <button
              onClick={() =>
                placement?.onMovePoint(index, {
                  latitude: point.latitude + 1,
                  longitude: point.longitude + 1,
                })
              }
              type="button"
            >
              Simulate dragging footprint point {index + 1}
            </button>
          </div>
        ))}
    </section>
  )
}
