import { describe, expect, test } from 'vitest'
import {
  doorsOutsideFootprint,
  isInsideFootprint,
} from '@/features/warehouses/geometry/footprint-validation'
import type { WarehouseDoorDto } from '@/features/warehouses/types'
import { doorLifecycle } from './support/fixtures'

const square = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 4 },
  { latitude: 4, longitude: 4 },
  { latitude: 4, longitude: 0 },
]

/** The notch opens toward the top, between longitude 1 and 3. */
const concave = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 4 },
  { latitude: 4, longitude: 4 },
  { latitude: 1, longitude: 2 },
  { latitude: 4, longitude: 0 },
]

const door = (name: string, latitude: number, longitude: number): WarehouseDoorDto => ({
  id: `door-${name}`,
  name,
  status: 'AVAILABLE',
  latitude,
  longitude,
  ...doorLifecycle(),
})

describe('warehouse footprint containment', () => {
  test('contains a point strictly inside a convex ring', () =>
    expect(isInsideFootprint(square, { latitude: 2, longitude: 2 })).toBe(true))

  test('excludes a point strictly outside a convex ring', () => {
    expect(isInsideFootprint(square, { latitude: 2, longitude: 5 })).toBe(false)
    expect(isInsideFootprint(square, { latitude: -1, longitude: 2 })).toBe(false)
  })

  test('contains a point lying exactly on an edge', () => {
    expect(isInsideFootprint(square, { latitude: 0, longitude: 2 })).toBe(true)
    expect(isInsideFootprint(square, { latitude: 2, longitude: 4 })).toBe(true)
  })

  test('contains a point lying exactly on a vertex', () =>
    expect(square.every((vertex) => isInsideFootprint(square, vertex))).toBe(true))

  test('contains a point lying on the implied closing edge', () =>
    expect(isInsideFootprint(square, { latitude: 2, longitude: 0 })).toBe(true))

  test('excludes a point sitting in the notch of a concave ring', () =>
    expect(isInsideFootprint(concave, { latitude: 3, longitude: 2 })).toBe(false))

  test('contains a point inside a concave ring but outside its notch', () =>
    expect(isInsideFootprint(concave, { latitude: 1, longitude: 1 })).toBe(true))

  test('is unaffected by the winding direction of the ring', () => {
    const reversed = [...square].reverse()

    expect(isInsideFootprint(reversed, { latitude: 2, longitude: 2 })).toBe(true)
    expect(isInsideFootprint(reversed, { latitude: 2, longitude: 5 })).toBe(false)
  })

  test('excludes a point aligned with a vertex but outside the ring', () => {
    expect(isInsideFootprint(square, { latitude: 0, longitude: 6 })).toBe(false)
    expect(isInsideFootprint(square, { latitude: 4, longitude: 6 })).toBe(false)
  })

  test('reports no door as outside when every door is contained', () =>
    expect(doorsOutsideFootprint(square, [door('D1', 2, 2), door('D2', 0, 2)])).toEqual([]))

  test('reports the offending doors in their stored order', () =>
    expect(
      doorsOutsideFootprint(square, [door('D1', 9, 9), door('D2', 2, 2), door('D3', -1, 2)]).map(
        (outside) => outside.name,
      ),
    ).toEqual(['D1', 'D3']))

  test('reports an archived door outside the ring like any other', () =>
    expect(
      doorsOutsideFootprint(square, [{ ...door('D4', 9, 9), status: 'ARCHIVED' }]).map(
        (outside) => outside.name,
      ),
    ).toEqual(['D4']))

  test('reports nothing for a warehouse with no doors', () =>
    expect(doorsOutsideFootprint(square, [])).toEqual([]))

  test('contains a point placed on a diagonal edge at realistic coordinates', () => {
    // Real site coordinates, where exact collinearity never holds: an exact test would call these
    // doors outside their own warehouse and refuse a correction that changes nothing.
    const footprint = [
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.85, longitude: 2.36 },
    ]

    expect(isInsideFootprint(footprint, { latitude: 48.855, longitude: 2.345 })).toBe(true)
    expect(isInsideFootprint(footprint, { latitude: 48.8552, longitude: 2.3452 })).toBe(true)
  })

  test('still excludes a point a metre outside a diagonal edge', () => {
    const footprint = [
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.85, longitude: 2.36 },
    ]

    expect(isInsideFootprint(footprint, { latitude: 48.855, longitude: 2.3449 })).toBe(false)
  })
})
