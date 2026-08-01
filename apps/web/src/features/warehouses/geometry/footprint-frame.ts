import type { WarehousePoint } from '@/features/warehouses/types'

export type Bounds = {
  minLongitude: number
  maxLongitude: number
  minLatitude: number
  maxLatitude: number
}

export function getFootprintBounds(points: WarehousePoint[]): Bounds | null {
  if (points.length === 0) {
    return null
  }
  return points.reduce(
    (bounds, point) => ({
      minLongitude: Math.min(bounds.minLongitude, point.longitude),
      maxLongitude: Math.max(bounds.maxLongitude, point.longitude),
      minLatitude: Math.min(bounds.minLatitude, point.latitude),
      maxLatitude: Math.max(bounds.maxLatitude, point.latitude),
    }),
    {
      minLongitude: points[0].longitude,
      maxLongitude: points[0].longitude,
      minLatitude: points[0].latitude,
      maxLatitude: points[0].latitude,
    },
  )
}

export function toPolygonCoordinates(points: WarehousePoint[]): [number, number][][] {
  if (points.length === 0) {
    return []
  }
  const coordinates = points.map(
    ({ latitude, longitude }) => [longitude, latitude] as [number, number],
  )
  return [[...coordinates, coordinates[0]]]
}
