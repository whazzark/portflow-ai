import type { MouseEvent } from 'react'
import type { ResourceMapCreateAction } from '@/components/resource-map/resource-map-create-control'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import type {
  WarehouseMapDoorPlacement,
  WarehouseMapEditing,
  WarehouseMapPlacement,
} from '@/features/warehouses/map/warehouse-map'
import type { PresentedWarehouse } from '@/features/warehouses/types'

/** Deterministic coordinates handed out by successive "map clicks", so a drawing test can build a
 * valid three-point footprint without MapLibre. */
/** Two points inside the first fixture warehouse's footprint, so a door placement test can place
 * and then move the pending door without leaving the warehouse it belongs to. */
export const MOCK_DOOR_CLICK_POINTS = [
  { latitude: 48.853, longitude: 2.35 },
  { latitude: 48.854, longitude: 2.351 },
]

export const MOCK_CLICK_POINTS = [
  { latitude: 10.5, longitude: 20.5 },
  { latitude: 11.5, longitude: 21.5 },
  { latitude: 12.5, longitude: 20.5 },
  { latitude: 13.5, longitude: 22.5 },
]

const STATUS_LABELS = { AVAILABLE: 'Available', ARCHIVED: 'Archived' } as const

/** Mirrors the real map's accessible contract — the labels, `aria-pressed`, shift-click behavior,
 * and footprint drawing a test drives — without MapLibre. Kept in step with
 * `warehouse-polygon.tsx`. */
export function WarehouseMap({
  warehouses,
  selected,
  onSelect,
  doors = [],
  onDoorSelect,
  placement,
  doorPlacement,
  editing,
  createActions = [],
  selectMode = false,
  checkedIds,
  checkableIds,
  onToggleChecked,
  onToggleSelectMode,
  onShiftSelect,
}: {
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
  onSelect: (warehouse: PresentedWarehouse) => void
  detailsPanelSide?: 'right' | 'bottom'
  onError?: (error: unknown) => void
  doors?: WarehouseDoorDto[]
  selectedDoorId?: string
  onDoorSelect?: (door: WarehouseDoorDto) => void
  placement?: WarehouseMapPlacement
  doorPlacement?: WarehouseMapDoorPlacement
  editing?: WarehouseMapEditing
  createActions?: ResourceMapCreateAction[]
  selectMode?: boolean
  checkedIds?: Set<string>
  checkableIds?: Set<string>
  onToggleChecked?: (id: string) => void
  onToggleSelectMode?: () => void
  onShiftSelect?: (id: string) => void
}) {
  const isArmed = placement?.armed ?? false
  const isPlacingDoor = doorPlacement?.armed ?? false
  // A door being corrected passes an *unarmed* placement: it is repositioned by dragging its own
  // marker, never by clicking the map. Mirrors `armed: false` in `warehouses-page.tsx`.
  const isEditingDoor = doorPlacement !== undefined && !doorPlacement.armed
  const doorPlacementLabel = doorPlacement?.label ?? 'New door'
  // The door under correction is represented by its draft marker instead of its ordinary one, so a
  // stale stored position and the live draft never both claim it. Mirrors `warehouse-map.tsx`.
  const renderedDoors = doorPlacement?.doorId
    ? doors.filter((door) => door.id !== doorPlacement.doorId)
    : doors
  const points = placement?.points ?? []
  const editedPoints = editing?.points ?? []
  const canRemove = editedPoints.length > (editing?.minimumPoints ?? 3)

  return (
    <section aria-label="Warehouse map">
      {createActions.map((action) => (
        <button key={action.key} onClick={action.onSelect} type="button">
          {action.label}
        </button>
      ))}
      {onToggleSelectMode && (
        <button aria-pressed={selectMode} onClick={onToggleSelectMode} type="button">
          {selectMode ? 'Stop selecting warehouses' : 'Select warehouses'}
        </button>
      )}
      {warehouses.map((warehouse) => {
        const isCheckable = checkableIds?.has(warehouse.id) ?? false
        const isSelectableNow = selectMode && isCheckable
        const checked = isSelectableNow ? (checkedIds?.has(warehouse.id) ?? false) : undefined

        return (
          <button
            aria-label={
              checked === undefined
                ? `View warehouse ${warehouse.name} (${STATUS_LABELS[warehouse.status]})`
                : `${checked ? 'Deselect' : 'Select'} warehouse ${warehouse.name}`
            }
            aria-pressed={checked ?? warehouse.id === selected?.id}
            data-checked={checked}
            data-search-match={warehouse.isSearchMatch}
            data-status={warehouse.status}
            // While a footprint is being drawn the map swallows clicks, so no warehouse is
            // selectable — mirrors `useResourceMapPlacement` arming the real canvas.
            // A warehouse under correction owns the map too: its own ring is being edited, so no
            // other warehouse is selectable either.
            disabled={isArmed || doorPlacement !== undefined || editing !== undefined}
            key={warehouse.id}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              if (isCheckable && event.shiftKey && onShiftSelect) {
                onShiftSelect(warehouse.id)
                return
              }
              if (isSelectableNow) {
                onToggleChecked?.(warehouse.id)
                return
              }
              onSelect(warehouse)
            }}
            type="button"
          >
            {warehouse.name} polygon
          </button>
        )
      })}
      {renderedDoors.map((door) => (
        <button
          key={door.id}
          // While a door is being placed the real marker takes no pointer event at all, so the
          // click lands on the map underneath and places the pending door instead of selecting
          // this one. Mirrors `pointer-events-none` in `warehouse-door-marker.tsx`.
          // While a door is being *corrected* the map places nothing, so the click reaches neither
          // this marker nor the draft: it simply does nothing.
          onClick={() => {
            if (isPlacingDoor) {
              doorPlacement?.onPlace(MOCK_DOOR_CLICK_POINTS[doorPlacement.pending ? 1 : 0])
              return
            }
            if (isEditingDoor) {
              return
            }
            onDoorSelect?.(door)
          }}
          type="button"
        >
          {door.name} door marker
        </button>
      ))}
      {isPlacingDoor && (
        <>
          <button
            onClick={() =>
              doorPlacement?.onPlace(MOCK_DOOR_CLICK_POINTS[doorPlacement.pending ? 1 : 0])
            }
            type="button"
          >
            Simulate map click to place the door
          </button>
          {doorPlacement?.pending && (
            <>
              <span data-testid="pending-door">
                {doorPlacement.pending.latitude}, {doorPlacement.pending.longitude}
              </span>
              <span>{doorPlacementLabel}</span>
              <button
                onClick={() =>
                  doorPlacement.onMove({
                    latitude: (doorPlacement.pending?.latitude ?? 0) + 0.0005,
                    longitude: (doorPlacement.pending?.longitude ?? 0) + 0.0005,
                  })
                }
                type="button"
              >
                Simulate dragging the pending door
              </button>
              <button
                onClick={() => doorPlacement.onMove({ latitude: 10, longitude: 10 })}
                type="button"
              >
                Simulate dragging the pending door outside the footprint
              </button>
            </>
          )}
        </>
      )}
      {isEditingDoor && (
        <>
          {/* A click landing anywhere on the map must leave the draft alone: only a drag moves it. */}
          <button onClick={() => {}} type="button">
            Simulate map click away from the door being edited
          </button>
          {doorPlacement?.pending && (
            <>
              <span data-testid="draft-door">
                {doorPlacement.pending.latitude}, {doorPlacement.pending.longitude}
              </span>
              <span>{doorPlacementLabel}</span>
              <button
                onClick={() =>
                  doorPlacement.onMove({
                    latitude: (doorPlacement.pending?.latitude ?? 0) + 0.0005,
                    // Toward the fixture triangle's apex rather than its left edge, so a drag stays
                    // comfortably inside the footprint instead of landing on its boundary.
                    longitude: (doorPlacement.pending?.longitude ?? 0) + 0.005,
                  })
                }
                type="button"
              >
                Simulate dragging the door being edited
              </button>
              <button
                onClick={() => doorPlacement.onMove({ latitude: 10, longitude: 10 })}
                type="button"
              >
                Simulate dragging the door being edited outside the footprint
              </button>
            </>
          )}
        </>
      )}
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
      {editing && (
        <>
          {/* A click landing anywhere but on a handle must leave the ring alone. */}
          <button onClick={() => {}} type="button">
            Simulate map click away from the outline
          </button>
          {editedPoints.map((point, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: boundary points are positional.
            <div key={`boundary-point-${index}`}>
              <span data-testid={`boundary-point-${index}`}>
                {point.latitude}, {point.longitude}
              </span>
              <button
                onClick={() =>
                  editing.onMovePoint(index, {
                    latitude: point.latitude + 1,
                    longitude: point.longitude + 1,
                  })
                }
                type="button"
              >
                Simulate dragging boundary point {index + 1}
              </button>
              <button
                onClick={() => {
                  const next = editedPoints[(index + 1) % editedPoints.length]
                  editing.onInsertPoint(index + 1, {
                    latitude: (point.latitude + next.latitude) / 2,
                    longitude: (point.longitude + next.longitude) / 2,
                  })
                }}
                type="button"
              >
                Simulate inserting on edge {index + 1}
              </button>
              <button
                disabled={!canRemove}
                onClick={() => editing.onRemovePoint(index)}
                type="button"
              >
                Simulate removing boundary point {index + 1}
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  )
}
