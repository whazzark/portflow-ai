import { describe, expect, test } from 'vitest'
import {
  checkFootprint,
  isSubmittableFootprint,
} from '@/features/warehouses/geometry/footprint-validation'

const triangle = [
  { latitude: 48.85, longitude: 2.34 },
  { latitude: 48.86, longitude: 2.35 },
  { latitude: 48.85, longitude: 2.36 },
]

describe('warehouse footprint validation', () => {
  test('accepts a simple triangle', () => {
    expect(checkFootprint(triangle)).toBeNull()
    expect(isSubmittableFootprint(triangle)).toBe(true)
  })

  test('accepts a concave outline', () =>
    expect(
      checkFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 4 },
        { latitude: 2, longitude: 2 },
        { latitude: 4, longitude: 4 },
        { latitude: 4, longitude: 0 },
      ]),
    ).toBeNull())

  test('reports too few points below three vertices', () => {
    expect(checkFootprint([])).toBe('TOO_FEW_POINTS')
    expect(checkFootprint(triangle.slice(0, 2))).toBe('TOO_FEW_POINTS')
    expect(isSubmittableFootprint(triangle.slice(0, 2))).toBe(false)
  })

  test('reports duplicate consecutive points', () =>
    expect(checkFootprint([triangle[0], triangle[0], triangle[1]])).toBe('DUPLICATE_POINT'))

  test('reports a last point equal to the first, since the closing edge is implied', () =>
    expect(checkFootprint([...triangle, triangle[0]])).toBe('DUPLICATE_POINT'))

  test('reports a bow-tie whose non-adjacent segments cross', () =>
    expect(
      checkFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 2, longitude: 2 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 0 },
      ]),
    ).toBe('SELF_INTERSECTING'))

  test('reports a crossing produced by the implied closing edge', () =>
    expect(
      checkFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 4 },
        { latitude: 2, longitude: -1 },
        { latitude: 4, longitude: 4 },
        { latitude: 4, longitude: 0 },
      ]),
    ).toBe('SELF_INTERSECTING'))

  test('treats adjacent segments sharing an endpoint as non-crossing', () =>
    expect(
      checkFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 2 },
        { latitude: 2, longitude: 0 },
      ]),
    ).toBeNull())

  test('reports three collinear points, which enclose no area', () => {
    const flat = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 0, longitude: 2 },
    ]

    expect(checkFootprint(flat)).toBe('FLAT_OUTLINE')
    expect(isSubmittableFootprint(flat)).toBe(false)
  })

  test('reports a flat outline of more than three collinear points', () =>
    expect(
      checkFootprint([
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 2 },
        { latitude: 3, longitude: 3 },
        { latitude: 4, longitude: 4 },
      ]),
    ).not.toBeNull())

  test('reports a non-adjacent vertex lying on another segment', () =>
    expect(
      checkFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 4 },
        { latitude: 4, longitude: 4 },
        { latitude: 0, longitude: 2 },
      ]),
    ).toBe('SELF_INTERSECTING'))
})
