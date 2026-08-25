import type * as GeoJSON from 'geojson'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { useResourceMapPlacement } from '@/components/resource-map/resource-map-placement'
import { MapGeoJSON, MapMarker, MarkerContent } from '@/components/ui/map'

const OUTLINE_ID = 'pending-footprint'

/** Below three points there is no ring to close, so finishing is not offered yet. */
const MINIMUM_RING_POINTS = 3

/** Two points can only be a line; three or more close into a ring whose final edge back to the
 * first point is implied, never stored. */
function toOutlineFeature(points: LatLng[]): GeoJSON.Feature | null {
  const coordinates = points.map(({ latitude, longitude }) => [longitude, latitude])

  if (coordinates.length < 2) {
    return null
  }

  return {
    type: 'Feature',
    properties: {},
    geometry:
      coordinates.length === 2
        ? { type: 'LineString', coordinates }
        : { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] },
  }
}

/**
 * A resource-agnostic pending polygon: arms the enclosing `<Map>` so clicks append boundary points,
 * renders the in-progress outline, and renders one draggable marker per point.
 *
 * Deliberately knows nothing about what the polygon represents — no warehouse vocabulary, no
 * minimum size, no validity rule. Those belong to the feature that consumes it. Must be used inside
 * a `<Map>`.
 */
export function PendingPolygonPlacement({
  armed,
  points,
  onAddPoint,
  onMovePoint,
  onComplete,
  completed = false,
  fillColor = '#2563eb',
}: {
  armed: boolean
  points: LatLng[]
  onAddPoint: (point: LatLng) => void
  onMovePoint: (index: number, point: LatLng) => void
  /** Called when the drawer clicks the first point to close the ring. */
  onComplete?: () => void
  /** A finished outline keeps its draggable points but stops taking new ones, so a stray click
   * can no longer reshape a polygon the drawer considers done. */
  completed?: boolean
  fillColor?: string
}) {
  useResourceMapPlacement({ armed: armed && !completed, onPlace: onAddPoint })

  if (!armed) {
    return null
  }

  const canComplete = !completed && points.length >= MINIMUM_RING_POINTS && onComplete !== undefined

  const outline = toOutlineFeature(points)

  return (
    <>
      {outline && (
        <MapGeoJSON
          data={{ type: 'FeatureCollection', features: [outline] }}
          fillPaint={
            outline.geometry.type === 'Polygon'
              ? { 'fill-color': fillColor, 'fill-opacity': 0.25 }
              : false
          }
          id={OUTLINE_ID}
          linePaint={{ 'line-color': fillColor, 'line-dasharray': [2, 2], 'line-width': 3 }}
        />
      )}
      {points.map((point, index) => (
        <MapMarker
          draggable
          // biome-ignore lint/suspicious/noArrayIndexKey: positional points — index is identity
          key={`pending-vertex-${index}`}
          latitude={point.latitude}
          longitude={point.longitude}
          onDragEnd={(lngLat) =>
            onMovePoint(index, { latitude: lngLat.lat, longitude: lngLat.lng })
          }
        >
          <MarkerContent>
            {index === 0 && canComplete ? (
              <button
                aria-label="Finish the outline"
                className="block size-4 cursor-pointer rounded-full border-2 border-white bg-primary shadow-lg ring-primary/40 hover:ring-4 focus-visible:outline-none focus-visible:ring-4 dark:border-neutral-900"
                data-pending-vertex={index}
                onClick={onComplete}
                type="button"
              />
            ) : (
              <span
                aria-hidden="true"
                className="block size-3.5 rounded-full border-2 border-white bg-primary shadow-lg dark:border-neutral-900"
                data-pending-vertex={index}
              />
            )}
          </MarkerContent>
        </MapMarker>
      ))}
    </>
  )
}
