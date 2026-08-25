import { SquareDashedMousePointer } from 'lucide-react'
import { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import type { ResourceMapCreateAction } from '@/components/resource-map/resource-map-create-control'
import { ResourceMapCreateControl } from '@/components/resource-map/resource-map-create-control'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
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

function getFitPadding(
  selected: PresentedWarehouse | undefined,
  detailsPanelSide: DetailsPanelSide | undefined,
  viewportHeight: number,
) {
  if (!selected || !detailsPanelSide) {
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
  const bounds = useMemo(() => {
    const items = selected ? [selected] : warehouses
    const frames = items
      .map((warehouse) => getFootprintBounds(warehouse.footprint.points))
      .filter((frame): frame is NonNullable<typeof frame> => frame !== null)

    if (frames.length === 0) {
      return null
    }

    return frames
      .slice(1)
      .reduce(
        (current, frame) =>
          current
            .extend([frame.minLongitude, frame.minLatitude])
            .extend([frame.maxLongitude, frame.maxLatitude]),
        new LngLatBounds(
          [frames[0].minLongitude, frames[0].minLatitude],
          [frames[0].maxLongitude, frames[0].maxLatitude],
        ),
      )
  }, [selected, warehouses])

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
      map.easeTo({ center: bounds.getCenter(), zoom: 13 })
      return
    }
    map.fitBounds(bounds, {
      maxZoom: selected ? 16 : 13,
      padding: getFitPadding(selected, detailsPanelSide, viewportHeight),
    })
  }, [bounds, detailsPanelSide, isLoaded, map, selected, viewportHeight])

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
  const isArmed = placement?.armed ?? false
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
          disabled={isArmed}
          selectMode={selectMode}
          checkedIds={checkedIds}
          checkableIds={checkableIds}
          onToggleChecked={onToggleChecked}
          onShiftSelect={onShiftSelect}
        />
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
        {selected &&
          onDoorSelect &&
          doors.map((door) => (
            <WarehouseDoorMarker
              key={door.id}
              door={door}
              doors={doors}
              onSelect={onDoorSelect}
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
            disabled={isArmed}
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
