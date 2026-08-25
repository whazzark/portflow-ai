import { InvalidWarehouseFootprintException } from './warehouse_exceptions.ts'

export type FootprintPoint = { latitude: number; longitude: number }

/** Longitude is the x axis and latitude the y axis. The footprint is a small planar ring — a few
 * to a few dozen vertices on one site — so plane geometry is exact enough here and no projection
 * or spherical model is warranted. */
const cross = (origin: FootprintPoint, a: FootprintPoint, b: FootprintPoint) =>
  (a.longitude - origin.longitude) * (b.latitude - origin.latitude) -
  (a.latitude - origin.latitude) * (b.longitude - origin.longitude)

const samePoint = (a: FootprintPoint, b: FootprintPoint) =>
  a.latitude === b.latitude && a.longitude === b.longitude

const isBetween = (point: FootprintPoint, start: FootprintPoint, end: FootprintPoint) =>
  Math.min(start.longitude, end.longitude) <= point.longitude &&
  point.longitude <= Math.max(start.longitude, end.longitude) &&
  Math.min(start.latitude, end.latitude) <= point.latitude &&
  point.latitude <= Math.max(start.latitude, end.latitude)

function segmentsIntersect(
  firstStart: FootprintPoint,
  firstEnd: FootprintPoint,
  secondStart: FootprintPoint,
  secondEnd: FootprintPoint,
) {
  const d1 = cross(firstStart, firstEnd, secondStart)
  const d2 = cross(firstStart, firstEnd, secondEnd)
  const d3 = cross(secondStart, secondEnd, firstStart)
  const d4 = cross(secondStart, secondEnd, firstEnd)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  // Collinear or touching: a vertex of one segment resting on the other still makes the outline
  // non-simple, so it is a crossing for our purposes.
  return (
    (d1 === 0 && isBetween(secondStart, firstStart, firstEnd)) ||
    (d2 === 0 && isBetween(secondEnd, firstStart, firstEnd)) ||
    (d3 === 0 && isBetween(firstStart, secondStart, secondEnd)) ||
    (d4 === 0 && isBetween(firstEnd, secondStart, secondEnd))
  )
}

/**
 * Asserts that an ordered footprint describes a simple (non-self-crossing) ring. The closing edge
 * from the last point back to the first is implied and MUST NOT be repeated by the caller, so a
 * last point equal to the first reads as a duplicate rather than as a closed ring.
 *
 * Pure and dependency-free by design (`research.md` R2): the update slice reuses it without going
 * through HTTP or persistence. O(n²) over a handful of vertices.
 */
export function assertSimpleFootprint(points: FootprintPoint[]) {
  for (let index = 0; index < points.length; index += 1) {
    if (samePoint(points[index], points[(index + 1) % points.length])) {
      throw new InvalidWarehouseFootprintException()
    }
  }

  for (let first = 0; first < points.length; first += 1) {
    const firstStart = points[first]
    const firstEnd = points[(first + 1) % points.length]

    for (let second = first + 1; second < points.length; second += 1) {
      const sharesEndpoint = second === first + 1 || (first === 0 && second === points.length - 1)

      if (sharesEndpoint) {
        continue
      }

      if (
        segmentsIntersect(
          firstStart,
          firstEnd,
          points[second],
          points[(second + 1) % points.length],
        )
      ) {
        throw new InvalidWarehouseFootprintException()
      }
    }
  }
}
