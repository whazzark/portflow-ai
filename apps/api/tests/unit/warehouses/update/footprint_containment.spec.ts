import { test } from '@japa/runner'
import { containsPoint, type FootprintPoint } from '#warehouses/shared/footprint_geometry'

/** A unit square, so every expectation below can be read off the coordinates. */
const SQUARE: FootprintPoint[] = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 4 },
  { latitude: 4, longitude: 4 },
  { latitude: 4, longitude: 0 },
]

/** The notch opens toward the top, between longitude 1 and 3. */
const CONCAVE: FootprintPoint[] = [
  { latitude: 0, longitude: 0 },
  { latitude: 0, longitude: 4 },
  { latitude: 4, longitude: 4 },
  { latitude: 1, longitude: 2 },
  { latitude: 4, longitude: 0 },
]

test.group('Warehouse footprint containment', () => {
  test('contains a point strictly inside a convex ring', ({ assert }) => {
    assert.isTrue(containsPoint(SQUARE, { latitude: 2, longitude: 2 }))
  })

  test('excludes a point strictly outside a convex ring', ({ assert }) => {
    assert.isFalse(containsPoint(SQUARE, { latitude: 2, longitude: 5 }))
    assert.isFalse(containsPoint(SQUARE, { latitude: -1, longitude: 2 }))
  })

  test('contains a point lying exactly on an edge', ({ assert }) => {
    assert.isTrue(containsPoint(SQUARE, { latitude: 0, longitude: 2 }))
    assert.isTrue(containsPoint(SQUARE, { latitude: 2, longitude: 4 }))
  })

  test('contains a point lying exactly on a vertex', ({ assert }) => {
    for (const vertex of SQUARE) {
      assert.isTrue(containsPoint(SQUARE, vertex))
    }
  })

  test('contains a point lying on the implied closing edge', ({ assert }) => {
    // The edge from the last point back to the first is never stored, but it bounds the ring.
    assert.isTrue(containsPoint(SQUARE, { latitude: 2, longitude: 0 }))
  })

  test('excludes a point sitting in the notch of a concave ring', ({ assert }) => {
    assert.isFalse(containsPoint(CONCAVE, { latitude: 3, longitude: 2 }))
  })

  test('contains a point inside a concave ring but outside its notch', ({ assert }) => {
    assert.isTrue(containsPoint(CONCAVE, { latitude: 1, longitude: 1 }))
  })

  test('is unaffected by the winding direction of the ring', ({ assert }) => {
    const reversed = [...SQUARE].reverse()

    assert.isTrue(containsPoint(reversed, { latitude: 2, longitude: 2 }))
    assert.isFalse(containsPoint(reversed, { latitude: 2, longitude: 5 }))
  })

  test('excludes a point aligned with a vertex but outside the ring', ({ assert }) => {
    // A ray leaving this point grazes the vertices at longitude 0 and 4; a naive even-odd count
    // that treats a grazed vertex as two crossings would report it as contained.
    assert.isFalse(containsPoint(SQUARE, { latitude: 0, longitude: 6 }))
    assert.isFalse(containsPoint(SQUARE, { latitude: 4, longitude: 6 }))
  })

  test('contains a point placed on a diagonal edge at realistic coordinates', ({ assert }) => {
    // Real site coordinates, where exact collinearity never holds: the differences that `cross`
    // multiplies carry ~1e-15 of rounding, so an exact test would call this door outside its own
    // warehouse and refuse a correction that changes nothing.
    const footprint: FootprintPoint[] = [
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.85, longitude: 2.36 },
    ]

    assert.isTrue(containsPoint(footprint, { latitude: 48.855, longitude: 2.345 }))
    assert.isTrue(containsPoint(footprint, { latitude: 48.8552, longitude: 2.3452 }))
  })

  test('still excludes a point a metre outside a diagonal edge', ({ assert }) => {
    const footprint: FootprintPoint[] = [
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.86, longitude: 2.35 },
      { latitude: 48.85, longitude: 2.36 },
    ]

    // ~1e-5 degrees is about a metre: well outside the 0.1 mm tolerance.
    assert.isFalse(containsPoint(footprint, { latitude: 48.855, longitude: 2.3449 }))
  })
})
