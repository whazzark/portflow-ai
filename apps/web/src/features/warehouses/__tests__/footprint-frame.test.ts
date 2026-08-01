import { describe, expect, test } from 'vitest'
import {
  getFootprintBounds,
  toPolygonCoordinates,
} from '@/features/warehouses/geometry/footprint-frame'

const points = [
  { latitude: 49, longitude: 1 },
  { latitude: 48, longitude: 3 },
  { latitude: 50, longitude: 2 },
]

describe('warehouse footprint framing', () => {
  test('frames every boundary point', () =>
    expect(getFootprintBounds(points)).toEqual({
      minLongitude: 1,
      maxLongitude: 3,
      minLatitude: 48,
      maxLatitude: 50,
    }))
  test('closes the GeoJSON polygon', () =>
    expect(toPolygonCoordinates(points)[0]).toEqual([
      [1, 49],
      [3, 48],
      [2, 50],
      [1, 49],
    ]))
})
