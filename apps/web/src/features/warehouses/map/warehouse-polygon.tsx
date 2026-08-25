import type * as GeoJSON from 'geojson'
import { useState } from 'react'
import type { MapGeoJSONEvent } from '@/components/ui/map'
import { MapGeoJSON, MapMarker, MapPopup, MarkerContent } from '@/components/ui/map'
import {
  getFootprintBounds,
  toPolygonCoordinates,
} from '@/features/warehouses/geometry/footprint-frame'
import { WarehouseMarkerSymbol } from '@/features/warehouses/map/warehouse-marker-symbol'
import { WAREHOUSE_STATUS_COLORS } from '@/features/warehouses/map/warehouse-status-colors'
import { WarehouseTooltip } from '@/features/warehouses/map/warehouse-tooltip'
import type { PresentedWarehouse } from '@/features/warehouses/types'
import { classnames } from '@/libraries/shadcn/helpers'

type WarehouseProperties = {
  id: string
  name: string
  status: PresentedWarehouse['status']
  isSearchMatch: boolean
  selected: boolean
  checked: boolean
}
type HoveredWarehouse = {
  warehouse: PresentedWarehouse
  longitude: number
  latitude: number
} | null

function toFeature(
  warehouse: PresentedWarehouse,
  selectedId?: string,
  checkedIds?: Set<string>,
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
      checked: checkedIds?.has(warehouse.id) ?? false,
    },
    geometry: { type: 'Polygon', coordinates: toPolygonCoordinates(warehouse.footprint.points) },
  }
}

export function WarehousePolygons({
  warehouses,
  selectedId,
  onSelect,
  hideTooltip = false,
  disabled = false,
  selectMode = false,
  checkedIds,
  checkableIds,
  onToggleChecked,
  onShiftSelect,
}: {
  warehouses: PresentedWarehouse[]
  selectedId?: string
  onSelect: (warehouse: PresentedWarehouse) => void
  hideTooltip?: boolean
  /** While a footprint is being drawn the map's clicks belong to the drawing, so no warehouse may
   * be selected — neither through its polygon layer nor through its focusable marker. */
  disabled?: boolean
  /** When true, a checkable warehouse's marker acts as a selection toggle instead of a details
   * trigger — the same contract `CheckpointMarker` honours when its `checked` prop is defined. */
  selectMode?: boolean
  checkedIds?: Set<string>
  checkableIds?: Set<string>
  onToggleChecked?: (id: string) => void
  onShiftSelect?: (id: string) => void
}) {
  const [hovered, setHovered] = useState<HoveredWarehouse>(null)
  const [focused, setFocused] = useState<PresentedWarehouse | null>(null)
  const tooltipWarehouse = focused ?? hovered?.warehouse
  const tooltipBounds = tooltipWarehouse
    ? getFootprintBounds(tooltipWarehouse.footprint.points)
    : null
  const available = warehouses.filter((warehouse) => warehouse.status === 'AVAILABLE')
  const archived = warehouses.filter((warehouse) => warehouse.status === 'ARCHIVED')

  const renderLayer = (items: PresentedWarehouse[], status: PresentedWarehouse['status']) => (
    <WarehousePolygonLayer
      disabled={disabled}
      items={items}
      onSelect={onSelect}
      onHover={setHovered}
      onFocus={setFocused}
      selectedId={selectedId}
      status={status}
      selectMode={selectMode}
      checkedIds={checkedIds}
      checkableIds={checkableIds}
      onToggleChecked={onToggleChecked}
      onShiftSelect={onShiftSelect}
    />
  )

  return (
    <>
      {renderLayer(available, 'AVAILABLE')}
      {renderLayer(archived, 'ARCHIVED')}
      {tooltipWarehouse && tooltipBounds && !hideTooltip && !disabled && (
        <MapPopup
          anchor="bottom"
          latitude={tooltipBounds.maxLatitude}
          longitude={(tooltipBounds.minLongitude + tooltipBounds.maxLongitude) / 2}
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
  disabled,
  selectMode = false,
  checkedIds,
  checkableIds,
  onToggleChecked,
  onShiftSelect,
}: {
  items: PresentedWarehouse[]
  selectedId?: string
  status: PresentedWarehouse['status']
  onSelect: (warehouse: PresentedWarehouse) => void
  onHover: (warehouse: HoveredWarehouse) => void
  onFocus: (warehouse: PresentedWarehouse | null) => void
  disabled: boolean
  selectMode?: boolean
  checkedIds?: Set<string>
  checkableIds?: Set<string>
  onToggleChecked?: (id: string) => void
  onShiftSelect?: (id: string) => void
}) {
  const data: GeoJSON.FeatureCollection<GeoJSON.Polygon, WarehouseProperties> = {
    type: 'FeatureCollection',
    features: items.map((item) => toFeature(item, selectedId, checkedIds)),
  }
  const paint = WAREHOUSE_STATUS_COLORS[status]
  return (
    <>
      <MapGeoJSON
        data={data}
        fillHoverPaint={{ 'fill-opacity': 0.55 }}
        fillPaint={{
          'fill-color': paint.fill,
          'fill-opacity': [
            'case',
            ['boolean', ['get', 'checked'], false],
            0.6,
            ['boolean', ['get', 'selected'], false],
            0.6,
            ['boolean', ['get', 'isSearchMatch'], true],
            0.32,
            0.18,
          ],
        }}
        id={`warehouses-${status.toLowerCase()}`}
        interactive={!disabled}
        linePaint={{
          'line-color': paint.line,
          'line-width': [
            'case',
            ['boolean', ['get', 'checked'], false],
            4,
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
          if (!warehouse) {
            return
          }
          if (selectMode && (checkableIds?.has(warehouse.id) ?? false)) {
            onToggleChecked?.(warehouse.id)
            return
          }
          onSelect(warehouse)
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
        // In select mode every marker renders: hiding the opened warehouse's marker (as the
        // details flow does, since its polygon is already emphasised) would make a warehouse
        // uncheckable purely because it happened to be opened first.
        if (!selectMode && warehouse.id === selectedId) {
          return null
        }
        const bounds = getFootprintBounds(warehouse.footprint.points)
        if (!bounds) {
          return null
        }
        const isCheckable = checkableIds?.has(warehouse.id) ?? false
        const isSelectableNow = selectMode && isCheckable
        const checked = isSelectableNow ? (checkedIds?.has(warehouse.id) ?? false) : undefined

        return (
          <MapMarker
            key={`focus-${warehouse.id}`}
            latitude={(bounds.minLatitude + bounds.maxLatitude) / 2}
            longitude={(bounds.minLongitude + bounds.maxLongitude) / 2}
          >
            <MarkerContent>
              <button
                aria-label={
                  checked === undefined
                    ? `View warehouse ${warehouse.name} (${warehouse.status === 'AVAILABLE' ? 'Available' : 'Archived'})`
                    : `${checked ? 'Deselect' : 'Select'} warehouse ${warehouse.name}`
                }
                aria-pressed={checked}
                disabled={disabled}
                className={classnames(
                  'grid size-11 cursor-pointer place-items-center rounded-full transition-[opacity,transform,filter] duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none',
                  checked && 'ring-2 ring-primary ring-offset-2',
                  warehouse.isSearchMatch ? 'scale-100 opacity-100' : 'scale-75 opacity-35',
                )}
                data-checked={checked}
                data-search-match={warehouse.isSearchMatch}
                onBlur={() => onFocus(null)}
                onClick={(event) => {
                  event.stopPropagation()
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
                onFocus={() => onFocus(warehouse)}
                type="button"
              >
                <WarehouseMarkerSymbol status={warehouse.status} />
              </button>
            </MarkerContent>
          </MapMarker>
        )
      })}
    </>
  )
}
