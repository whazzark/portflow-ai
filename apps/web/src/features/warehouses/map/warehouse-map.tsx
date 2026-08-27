import { DoorOpenIcon, SquareDashedMousePointer } from 'lucide-react'
import { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import type { ResourceMapCreateAction } from '@/components/resource-map/resource-map-create-control'
import { ResourceMapCreateControl } from '@/components/resource-map/resource-map-create-control'
import {
  type LatLng,
  PendingPlacementMarker,
  useResourceMapPlacement,
} from '@/components/resource-map/resource-map-placement'
import { EditablePolygonPlacement } from '@/components/resource-map/resource-map-polygon-editing'
import { PendingPolygonPlacement } from '@/components/resource-map/resource-map-polygon-placement'
import {
  ControlButton,
  ControlGroup,
  Map as MapCanvas,
  MapControls,
  useMap,
} from '@/components/ui/map'
import { mapStyleUrls } from '@/config/map'
import { WarehouseDoorMarker } from '@/features/warehouse-doors/map/warehouse-door-marker'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import { getFootprintBounds } from '@/features/warehouses/geometry/footprint-frame'
import { WarehousePolygons } from '@/features/warehouses/map/warehouse-polygon'
import type { PresentedWarehouse } from '@/features/warehouses/types'

const MAP_EDGE_PADDING = 56
/** A selected warehouse is framed as tightly as the basemap allows, so its doors are far enough
 * apart to tell apart and to place a new one between them. The collection view stays wide. */
const SELECTED_MAX_ZOOM = 19
const COLLECTION_MAX_ZOOM = 13
const DESKTOP_PANEL_MAX_WIDTH = 32 * 16
const MOBILE_PANEL_MAX_HEIGHT = 38 * 16
const MOBILE_PANEL_VIEWPORT_RATIO = 0.75

type DetailsPanelSide = 'right' | 'bottom'

export type WarehouseMapPlacement = {
  armed: boolean
  points: LatLng[]
  onAddPoint: (point: LatLng) => void
  onMovePoint: (index: number, point: LatLng) => void
  onComplete: () => void
  completed: boolean
}

export type WarehouseMapDoorPlacement = {
  /** True while a *new* door is being placed, so a map click sets the point. False while an
   * existing door is being corrected: it is repositioned by dragging its own marker or by typing
   * coordinates, never by a click, which among sibling door markers reads as "select that one". */
  armed: boolean
  pending: LatLng | null
  onPlace: (point: LatLng) => void
  onMove: (point: LatLng) => void
  /** Caption under the marker. "New door" while creating; the door's own name while correcting. */
  label?: string
  /** The door this placement stands in for while it is corrected; absent while creating. Its
   * ordinary marker is withheld, so a stale stored position and the live draft never both claim
   * the same door. */
  doorId?: string
}

/** Composes the shared click-to-place hook with the shared pending marker, exactly as
 * `CheckpointPlacementLayer` does: what is shared is the hook and the marker, while the icon, the
 * label, and what arms them are this feature's business. Must be used inside a `<Map>`. */
function WarehouseDoorPlacementLayer({ placement }: { placement: WarehouseMapDoorPlacement }) {
  useResourceMapPlacement({ armed: placement.armed, onPlace: placement.onPlace })

  if (!placement.pending) {
    return null
  }

  return (
    <PendingPlacementMarker
      label={placement.label ?? 'New door'}
      onMove={placement.onMove}
      position={placement.pending}
    >
      <span
        className="grid size-8 place-items-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-lg dark:border-neutral-900"
        data-pending-placement-marker
      >
        <DoorOpenIcon aria-hidden="true" className="size-4" />
      </span>
    </PendingPlacementMarker>
  )
}

export type WarehouseMapEditing = {
  /** The warehouse whose ring is being corrected — excluded from the selection layer meanwhile. */
  warehouseId: string
  points: LatLng[]
  onMovePoint: (index: number, point: LatLng) => void
  onInsertPoint: (index: number, point: LatLng) => void
  onRemovePoint: (index: number) => void
  minimumPoints: number
}

function getFitPadding(
  hasSelection: boolean,
  detailsPanelSide: DetailsPanelSide | undefined,
  viewportHeight: number,
) {
  if (!hasSelection || !detailsPanelSide) {
    return MAP_EDGE_PADDING
  }

  const padding = {
    top: MAP_EDGE_PADDING,
    right: MAP_EDGE_PADDING,
    bottom: MAP_EDGE_PADDING,
    left: MAP_EDGE_PADDING,
  }

  if (detailsPanelSide === 'right') {
    padding.right += DESKTOP_PANEL_MAX_WIDTH
  } else {
    padding.bottom += Math.min(
      viewportHeight * MOBILE_PANEL_VIEWPORT_RATIO,
      MOBILE_PANEL_MAX_HEIGHT,
    )
  }

  return padding
}

function FitWarehouseBounds({
  detailsPanelSide,
  warehouses,
  selected,
}: {
  detailsPanelSide?: DetailsPanelSide
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
}) {
  const { map, isLoaded } = useMap()
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 0 : window.innerHeight,
  )
  const hasSelection = selected !== undefined
  // The page presents its warehouses afresh on every render, so the frames are keyed by value the
  // way the checkpoint map keys its own: keyed by identity, the fit would replay on every state
  // change — each door point placed, each coordinate typed — and haul the view back from wherever
  // the administrator had panned or zoomed it.
  const framesKey = (selected ? [selected] : warehouses)
    .map((warehouse) => getFootprintBounds(warehouse.footprint.points))
    .filter((frame): frame is NonNullable<typeof frame> => frame !== null)
    .map((frame) =>
      [frame.minLongitude, frame.minLatitude, frame.maxLongitude, frame.maxLatitude].join(':'),
    )
    .sort()
    .join('|')
  const bounds = useMemo(() => {
    if (!framesKey) {
      return null
    }

    return framesKey.split('|').reduce((current, frame) => {
      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = frame.split(':').map(Number)

      return current.extend([minLongitude, minLatitude]).extend([maxLongitude, maxLatitude])
    }, new LngLatBounds())
  }, [framesKey])

  useEffect(() => {
    if (detailsPanelSide !== 'bottom') {
      return
    }

    const updateViewportHeight = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', updateViewportHeight)
    updateViewportHeight()

    return () => window.removeEventListener('resize', updateViewportHeight)
  }, [detailsPanelSide])

  useEffect(() => {
    if (!map || !isLoaded || !bounds) {
      return
    }
    const northEast = bounds.getNorthEast()
    const southWest = bounds.getSouthWest()
    if (northEast.lng === southWest.lng && northEast.lat === southWest.lat) {
      map.easeTo({
        center: bounds.getCenter(),
        zoom: hasSelection ? SELECTED_MAX_ZOOM : COLLECTION_MAX_ZOOM,
      })
      return
    }
    map.fitBounds(bounds, {
      maxZoom: hasSelection ? SELECTED_MAX_ZOOM : COLLECTION_MAX_ZOOM,
      padding: getFitPadding(hasSelection, detailsPanelSide, viewportHeight),
    })
  }, [bounds, detailsPanelSide, hasSelection, isLoaded, map, viewportHeight])

  return null
}

export function WarehouseMap({
  detailsPanelSide,
  warehouses,
  selected,
  onSelect,
  onError,
  doors = [],
  selectedDoorId,
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
  detailsPanelSide?: DetailsPanelSide
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
  onSelect: (warehouse: PresentedWarehouse) => void
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
  /** Present only for administrators; its absence is what hides the select control entirely. */
  onToggleSelectMode?: () => void
  onShiftSelect?: (id: string) => void
}) {
  const [hoveredDoorId, setHoveredDoorId] = useState<string>()
  // A ring under correction owns the map exactly like an armed drawing does: nothing else is
  // selectable, and the view must not re-fit under the administrator on every vertex they move.
  // Only a ring being drawn or corrected suppresses the fit: those change the bounds under the
  // administrator on every vertex. Door placement changes no polygon — the bounds stay the selected
  // warehouse's stored footprint — so it keeps the fit and only stops other things being selected.
  const isArmed = (placement?.armed ?? false) || editing !== undefined
  // A door placement of *either* kind owns the map: while a new door is being placed a click must
  // place it rather than select something, and while an existing one is being corrected a click
  // must select nothing at all. Only `armed` decides whether that click also places a point.
  const suppressesSelection = isArmed || doorPlacement !== undefined
  // The door under correction is represented by its draft marker below instead of its ordinary one.
  const renderedDoors = doorPlacement?.doorId
    ? doors.filter((door) => door.id !== doorPlacement.doorId)
    : doors
  const initialCenter = useMemo<[number, number]>(() => {
    const point = warehouses[0]?.footprint.points[0]
    return point ? [point.longitude, point.latitude] : [-1.2264, 46.1591]
  }, [warehouses])

  return (
    <div className="relative h-full min-h-0 w-full flex-1 overflow-hidden">
      <MapCanvas
        center={initialCenter}
        className="h-full"
        onMapError={onError}
        styles={mapStyleUrls}
        zoom={warehouses.length === 1 ? 13 : 5}
      >
        {!isArmed && (
          <FitWarehouseBounds
            detailsPanelSide={detailsPanelSide}
            warehouses={warehouses}
            selected={selected}
          />
        )}
        <WarehousePolygons
          warehouses={warehouses}
          selectedId={selected?.id}
          onSelect={onSelect}
          hideTooltip={hoveredDoorId !== undefined}
          disabled={suppressesSelection}
          selectMode={selectMode}
          checkedIds={checkedIds}
          checkableIds={checkableIds}
          onToggleChecked={onToggleChecked}
          onShiftSelect={onShiftSelect}
          excludedId={editing?.warehouseId}
        />
        {editing && (
          <EditablePolygonPlacement
            minimumPoints={editing.minimumPoints}
            onInsertPoint={editing.onInsertPoint}
            onMovePoint={editing.onMovePoint}
            onRemovePoint={editing.onRemovePoint}
            points={editing.points}
          />
        )}
        {placement && (
          <PendingPolygonPlacement
            armed={placement.armed}
            completed={placement.completed}
            onAddPoint={placement.onAddPoint}
            onComplete={placement.onComplete}
            onMovePoint={placement.onMovePoint}
            points={placement.points}
          />
        )}
        {doorPlacement && <WarehouseDoorPlacementLayer placement={doorPlacement} />}
        {/* Doors stay rendered while the ring is corrected: they are the constraint the
            administrator is shaping around, so hiding them would make a refusal feel arbitrary. */}
        {selected &&
          onDoorSelect &&
          renderedDoors.map((door) => (
            <WarehouseDoorMarker
              key={door.id}
              door={door}
              doors={renderedDoors}
              // While a door is being placed, a click on an existing marker must place the pending
              // point rather than select that door — the map only places in this mode. While one is
              // being corrected, the marker takes no pointer event either: the click selects
              // nothing and moves nothing, because only a drag repositions the draft.
              onSelect={doorPlacement !== undefined ? undefined : onDoorSelect}
              selected={door.id === selectedDoorId}
              onHoverChange={(hovered) => setHoveredDoorId(hovered ? door.id : undefined)}
            />
          ))}
        <MapControls position="bottom-right" showZoom>
          {onToggleSelectMode && (
            <ControlGroup>
              <ControlButton
                active={selectMode}
                label={selectMode ? 'Stop selecting warehouses' : 'Select warehouses'}
                onClick={onToggleSelectMode}
              >
                <SquareDashedMousePointer aria-hidden="true" className="size-4" />
              </ControlButton>
            </ControlGroup>
          )}
          <ResourceMapCreateControl actions={createActions} />
        </MapControls>
      </MapCanvas>
      <section aria-label="Warehouses on map" className="sr-only">
        {warehouses.map((warehouse) => (
          <button
            disabled={suppressesSelection}
            key={warehouse.id}
            onClick={() => onSelect(warehouse)}
            title={`${warehouse.name} — ${warehouse.status === 'AVAILABLE' ? 'Available' : 'Archived'}`}
            type="button"
          >
            {warehouse.name} ({warehouse.status === 'AVAILABLE' ? 'Available' : 'Archived'})
          </button>
        ))}
      </section>
    </div>
  )
}
