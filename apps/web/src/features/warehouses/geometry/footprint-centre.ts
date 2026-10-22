import type { LatLng } from '@/components/resource-map/resource-map-placement'

/**
 * The display centre of a footprint: its area-weighted centroid, which — unlike the centre of its
 * bounds — stays inside an L-shaped building. A degenerate outline with no area falls back to the
 * mean of its vertices. Planar on latitude/longitude, which is exact enough at a building's scale.
 */
export function footprintCentre(points: LatLng[]): LatLng {
  let twiceArea = 0
  let latitude = 0
  let longitude = 0

  points.forEach((current, index) => {
    const next = points[(index + 1) % points.length]
    const cross = current.longitude * next.latitude - next.longitude * current.latitude
    twiceArea += cross
    longitude += (current.longitude + next.longitude) * cross
    latitude += (current.latitude + next.latitude) * cross
  })

  if (Math.abs(twiceArea) < Number.EPSILON) {
    return {
      latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
      longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
    }
  }

  return { latitude: latitude / (3 * twiceArea), longitude: longitude / (3 * twiceArea) }
}

export function formatCoordinates({ latitude, longitude }: LatLng) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}
