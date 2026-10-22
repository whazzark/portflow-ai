import { describe, expect, test } from 'vitest'
import { footprintCentre, formatCoordinates } from '@/features/warehouses/geometry/footprint-centre'

describe('footprint centre', () => {
  test('is the centre of a square', () => {
    expect(
      footprintCentre([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 2 },
        { latitude: 2, longitude: 0 },
      ]),
    ).toEqual({ latitude: 1, longitude: 1 })
  })

  test('weights an L-shaped footprint by area rather than taking its bounds centre', () => {
    // A 2×2 square with its top-right 1×1 quarter removed: bounds centre (1, 1), centroid (5/6, 5/6).
    const centre = footprintCentre([
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 2 },
      { latitude: 1, longitude: 2 },
      { latitude: 1, longitude: 1 },
      { latitude: 2, longitude: 1 },
      { latitude: 2, longitude: 0 },
    ])

    expect(centre.latitude).toBeCloseTo(5 / 6)
    expect(centre.longitude).toBeCloseTo(5 / 6)
  })

  test('falls back to the vertex mean for a degenerate outline', () => {
    expect(
      footprintCentre([
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
      ]),
    ).toEqual({ latitude: 1, longitude: 1 })
  })

  test('formats coordinates to four decimals', () => {
    expect(formatCoordinates({ latitude: 46.155_712, longitude: -1.227_04 })).toBe(
      '46.1557, -1.2270',
    )
  })
})
