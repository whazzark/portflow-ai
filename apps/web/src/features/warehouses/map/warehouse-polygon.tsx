import type * as GeoJSON from 'geojson'
import { useState } from 'react'
import type { MapGeoJSONEvent } from '@/components/ui/map'
import { MapGeoJSON, MapMarker, MapPopup, MarkerContent } from '@/components/ui/map'
import {
  getFootprintBounds,
  toPolygonCoordinates,
} from '@/features/warehouses/geometry/footprint-frame'
import { WarehouseTooltip } from '@/features/warehouses/map/warehouse-tooltip'
import type { PresentedWarehouse } from '@/features/warehouses/types'

type WarehouseProperties = {
  id: string
  name: string
  status: PresentedWarehouse['status']
  isSearchMatch: boolean
  selected: boolean
}
type HoveredWarehouse = {
  warehouse: PresentedWarehouse
  longitude: number
  latitude: number
} | null

function toFeature(
  warehouse: PresentedWarehouse,
  selectedId?: string,
): GeoJSON.Feature<GeoJSON.Polygon, WarehouseProperties> {
  return {
    type: 'Feature',
    id: warehouse.id,
    properties: {
      id: warehouse.id,
      name: warehouse.name,
      status: warehouse.status,
      isSearchMatch: warehouse.isSearchMatch,
      selected: warehouse.id === selectedId,
    },
    geometry: { type: 'Polygon', coordinates: toPolygonCoordinates(warehouse.footprint.points) },
  }
}

export function WarehousePolygons({
  warehouses,
  selectedId,
  onSelect,
}: {
  warehouses: PresentedWarehouse[]
  selectedId?: string
  onSelect: (warehouse: PresentedWarehouse) => void
}) {
  const [hovered, setHovered] = useState<HoveredWarehouse>(null)
  const [focused, setFocused] = useState<PresentedWarehouse | null>(null)
  const available = warehouses.filter((warehouse) => warehouse.status === 'AVAILABLE')
  const archived = warehouses.filter((warehouse) => warehouse.status === 'ARCHIVED')
  const focusedBounds = focused ? getFootprintBounds(focused.footprint.points) : null
  const tooltipWarehouse = focused ?? hovered?.warehouse

  const renderLayer = (items: PresentedWarehouse[], status: PresentedWarehouse['status']) => (
    <WarehousePolygonLayer
      items={items}
      onSelect={onSelect}
      onHover={setHovered}
      onFocus={setFocused}
      selectedId={selectedId}
      status={status}
    />
  )

  return (
    <>
      {renderLayer(available, 'AVAILABLE')}
      {renderLayer(archived, 'ARCHIVED')}
      {tooltipWarehouse && (
        <MapPopup
          latitude={
            hovered?.latitude ??
            (focusedBounds ? (focusedBounds.minLatitude + focusedBounds.maxLatitude) / 2 : 0)
          }
          longitude={
            hovered?.longitude ??
            (focusedBounds ? (focusedBounds.minLongitude + focusedBounds.maxLongitude) / 2 : 0)
          }
          closeButton={false}
          closeOnClick={false}
          className="pointer-events-none text-balance rounded-md bg-foreground px-2 py-1 text-background text-xs shadow-md"
        >
          <WarehouseTooltip warehouse={tooltipWarehouse} />
        </MapPopup>
      )}
    </>
  )
}

function WarehousePolygonLayer({
  items,
  status,
  selectedId,
  onSelect,
  onHover,
  onFocus,
}: {
  items: PresentedWarehouse[]
  selectedId?: string
  status: PresentedWarehouse['status']
  onSelect: (warehouse: PresentedWarehouse) => void
  onHover: (warehouse: HoveredWarehouse) => void
  onFocus: (warehouse: PresentedWarehouse | null) => void
}) {
  const data: GeoJSON.FeatureCollection<GeoJSON.Polygon, WarehouseProperties> = {
    type: 'FeatureCollection',
    features: items.map((item) => toFeature(item, selectedId)),
  }
  const paint =
    status === 'AVAILABLE'
      ? { fill: '#2563eb', line: '#1d4ed8' }
      : { fill: '#94a3b8', line: '#64748b' }
  return (
    <>
      <MapGeoJSON
        data={data}
        fillHoverPaint={{ 'fill-opacity': 0.55 }}
        fillPaint={{
          'fill-color': paint.fill,
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'selected'], false],
            0.48,
            ['boolean', ['get', 'isSearchMatch'], true],
            0.2,
            0.08,
          ],
        }}
        id={`warehouses-${status.toLowerCase()}`}
        interactive
        linePaint={{
          'line-color': paint.line,
          'line-width': [
            'case',
            ['boolean', ['get', 'selected'], false],
            4,
            ['boolean', ['get', 'isSearchMatch'], true],
            2,
            1,
          ],
          ...(status === 'ARCHIVED' ? { 'line-dasharray': [2, 2] } : {}),
        }}
        onClick={(event) => {
          const warehouse = items.find((item) => item.id === event.feature.properties.id)
          if (warehouse) {
            onSelect(warehouse)
          }
        }}
        onHover={(event: MapGeoJSONEvent<WarehouseProperties> | null) => {
          if (!event) {
            onHover(null)
            return
          }
          const warehouse = items.find((item) => item.id === event.feature.properties.id)
          onHover(
            warehouse ? { warehouse, longitude: event.longitude, latitude: event.latitude } : null,
          )
        }}
        promoteId="id"
      />
      {items.map((warehouse) => {
        const bounds = getFootprintBounds(warehouse.footprint.points)
        if (!bounds) {
          return null
        }
        return (
          <MapMarker
            key={`focus-${warehouse.id}`}
            latitude={(bounds.minLatitude + bounds.maxLatitude) / 2}
            longitude={(bounds.minLongitude + bounds.maxLongitude) / 2}
          >
            <MarkerContent>
              <button
                aria-label={`View warehouse ${warehouse.name} (${warehouse.status === 'AVAILABLE' ? 'Available' : 'Archived'})`}
                className="size-10 rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-search-match={warehouse.isSearchMatch}
                onBlur={() => onFocus(null)}
                onClick={() => onSelect(warehouse)}
                onFocus={() => onFocus(warehouse)}
                type="button"
              />
            </MarkerContent>
          </MapMarker>
        )
      })}
    </>
  )
}
