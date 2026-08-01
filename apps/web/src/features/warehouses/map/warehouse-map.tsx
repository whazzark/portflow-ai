import { LngLatBounds } from 'maplibre-gl'
import { useEffect, useMemo, useState } from 'react'
import { Map as MapCanvas, useMap } from '@/components/ui/map'
import { mapStyleUrls } from '@/config/map'
import { WarehouseDoorMarker } from '@/features/warehouse-doors/map/warehouse-door-marker'
import type { WarehouseDoorDto } from '@/features/warehouse-doors/types'
import { getFootprintBounds } from '@/features/warehouses/geometry/footprint-frame'
import { WarehousePolygons } from '@/features/warehouses/map/warehouse-polygon'
import type { PresentedWarehouse } from '@/features/warehouses/types'

function FitWarehouseBounds({
  warehouses,
  selected,
}: {
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
}) {
  const { map, isLoaded } = useMap()
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
    if (!map || !isLoaded || !bounds) {
      return
    }
    const northEast = bounds.getNorthEast()
    const southWest = bounds.getSouthWest()
    if (northEast.lng === southWest.lng && northEast.lat === southWest.lat) {
      map.easeTo({ center: bounds.getCenter(), zoom: 13 })
      return
    }
    map.fitBounds(bounds, { maxZoom: selected ? 16 : 13, padding: 56 })
  }, [bounds, isLoaded, map, selected])

  return null
}

export function WarehouseMap({
  warehouses,
  selected,
  onSelect,
  onError,
  doors = [],
  selectedDoorId,
  onDoorSelect,
}: {
  warehouses: PresentedWarehouse[]
  selected?: PresentedWarehouse
  onSelect: (warehouse: PresentedWarehouse) => void
  onError?: (error: unknown) => void
  doors?: WarehouseDoorDto[]
  selectedDoorId?: string
  onDoorSelect?: (door: WarehouseDoorDto) => void
}) {
  const [hoveredDoorId, setHoveredDoorId] = useState<string>()
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
        <FitWarehouseBounds warehouses={warehouses} selected={selected} />
        <WarehousePolygons
          warehouses={warehouses}
          selectedId={selected?.id}
          onSelect={onSelect}
          hideTooltip={hoveredDoorId !== undefined}
        />
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
      </MapCanvas>
      <section aria-label="Warehouses on map" className="sr-only">
        {warehouses.map((warehouse) => (
          <button
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
