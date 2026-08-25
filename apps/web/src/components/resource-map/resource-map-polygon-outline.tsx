import type * as GeoJSON from 'geojson'
import type { LatLng } from '@/components/resource-map/resource-map-placement'
import { MapGeoJSON } from '@/components/ui/map'

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
 * The outline both polygon layers draw — the one being drawn and the one being edited. Shared so the
 * two never drift apart visually, which is the part that must not diverge; everything else about
 * drawing and editing differs and lives in its own layer.
 */
export function PolygonOutline({
  id,
  points,
  fillColor,
}: {
  id: string
  points: LatLng[]
  fillColor: string
}) {
  const outline = toOutlineFeature(points)

  if (!outline) {
    return null
  }

  return (
    <MapGeoJSON
      data={{ type: 'FeatureCollection', features: [outline] }}
      fillPaint={
        outline.geometry.type === 'Polygon'
          ? { 'fill-color': fillColor, 'fill-opacity': 0.25 }
          : false
      }
      id={id}
      linePaint={{ 'line-color': fillColor, 'line-dasharray': [2, 2], 'line-width': 3 }}
    />
  )
}
