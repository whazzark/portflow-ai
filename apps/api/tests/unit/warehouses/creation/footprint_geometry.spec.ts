import { test } from '@japa/runner'
import {
  assertSimpleFootprint,
  FLAT_FOOTPRINT_MESSAGE,
  type FootprintPoint,
} from '#warehouses/shared/footprint_geometry'
import { InvalidWarehouseFootprintException } from '#warehouses/shared/warehouse_exceptions'

const TRIANGLE: FootprintPoint[] = [
  { latitude: 48.85, longitude: 2.34 },
  { latitude: 48.86, longitude: 2.35 },
  { latitude: 48.85, longitude: 2.36 },
]

test.group('Warehouse footprint geometry', () => {
  test('accepts a simple triangle', ({ assert }) => {
    assert.doesNotThrow(() => assertSimpleFootprint(TRIANGLE))
  })

  test('accepts a concave outline', ({ assert }) => {
    assert.doesNotThrow(() =>
      assertSimpleFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 4 },
        { latitude: 2, longitude: 2 },
        { latitude: 4, longitude: 4 },
        { latitude: 4, longitude: 0 },
      ]),
    )
  })

  test('accepts a many-vertex convex outline', ({ assert }) => {
    const points = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * 2 * Math.PI
      return { latitude: Math.sin(angle), longitude: Math.cos(angle) }
    })

    assert.doesNotThrow(() => assertSimpleFootprint(points))
  })

  test('rejects a bow-tie whose non-adjacent segments cross', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 0, longitude: 0 },
          { latitude: 2, longitude: 2 },
          { latitude: 0, longitude: 2 },
          { latitude: 2, longitude: 0 },
        ]),
      new InvalidWarehouseFootprintException().message,
    )
  })

  test('rejects a crossing produced by the implied closing edge', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 4 },
          { latitude: 2, longitude: -1 },
          { latitude: 4, longitude: 4 },
          { latitude: 4, longitude: 0 },
        ]),
      new InvalidWarehouseFootprintException().message,
    )
  })

  test('rejects duplicate consecutive points', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 48.85, longitude: 2.34 },
          { latitude: 48.85, longitude: 2.34 },
          { latitude: 48.86, longitude: 2.35 },
        ]),
      new InvalidWarehouseFootprintException().message,
    )
  })

  test('rejects a last point equal to the first, since the closing edge is implied', ({
    assert,
  }) => {
    assert.throws(
      () => assertSimpleFootprint([...TRIANGLE, TRIANGLE[0]]),
      new InvalidWarehouseFootprintException().message,
    )
  })

  test('treats adjacent segments sharing an endpoint as non-crossing', ({ assert }) => {
    assert.doesNotThrow(() =>
      assertSimpleFootprint([
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
        { latitude: 2, longitude: 2 },
        { latitude: 2, longitude: 0 },
      ]),
    )
  })

  test('rejects three collinear points, which enclose no area', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 1 },
          { latitude: 0, longitude: 2 },
        ]),
      FLAT_FOOTPRINT_MESSAGE,
    )
  })

  test('rejects a flat outline of more than three collinear points', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 1, longitude: 1 },
          { latitude: 2, longitude: 2 },
          { latitude: 3, longitude: 3 },
          { latitude: 4, longitude: 4 },
        ]),
      new InvalidWarehouseFootprintException().message,
    )
  })

  test('rejects a non-adjacent vertex lying on another segment', ({ assert }) => {
    assert.throws(
      () =>
        assertSimpleFootprint([
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 4 },
          { latitude: 4, longitude: 4 },
          { latitude: 0, longitude: 2 },
        ]),
      new InvalidWarehouseFootprintException().message,
    )
  })
})
