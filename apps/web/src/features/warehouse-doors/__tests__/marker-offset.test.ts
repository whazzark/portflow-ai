import { describe, expect, test } from 'vitest'
import { getResourceMarkerOffset } from '@/components/resource-map/resource-marker-offset'

const doors = [
  { id: 'a', latitude: 1, longitude: 2 },
  { id: 'b', latitude: 1, longitude: 2 },
]

describe('warehouse door marker offsets', () => {
  test('fans co-located doors into deterministic positions', () => {
    expect(getResourceMarkerOffset(doors[0], doors)).not.toEqual([0, 0])
    expect(getResourceMarkerOffset(doors[0], doors)).toEqual(
      getResourceMarkerOffset(doors[0], doors),
    )
    expect(getResourceMarkerOffset({ id: 'c', latitude: 9, longitude: 9 }, doors)).toEqual([0, 0])
  })
})
