import { InvalidWarehouseFootprintException } from './warehouse_exceptions.ts'

export type FootprintPoint = { latitude: number; longitude: number }

export const FLAT_FOOTPRINT_MESSAGE = 'Warehouse footprint outline must enclose an area'

/** Longitude is the x axis and latitude the y axis. The footprint is a small planar ring — a few
 * to a few dozen vertices on one site — so plane geometry is exact enough here and no projection
 * or spherical model is warranted. */
const cross = (origin: FootprintPoint, a: FootprintPoint, b: FootprintPoint) =>
  (a.longitude - origin.longitude) * (b.latitude - origin.latitude) -
  (a.latitude - origin.latitude) * (b.longitude - origin.longitude)

const samePoint = (a: FootprintPoint, b: FootprintPoint) =>
  a.latitude === b.latitude && a.longitude === b.longitude

/** Twice the signed area of the ring (the shoelace sum, kept undivided so it stays exact on
 * integer inputs). Zero means every vertex sits on one line, so the outline encloses nothing. */
const doubleSignedArea = (points: FootprintPoint[]) =>
  points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length]
    return total + (point.longitude * next.latitude - next.longitude * point.latitude)
  }, 0)

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
 * Asserts that an ordered footprint describes a simple (non-self-crossing) ring enclosing an area.
 * The closing edge from the last point back to the first is implied and MUST NOT be repeated by the
 * caller, so a last point equal to the first reads as a duplicate rather than as a closed ring.
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

  // Last, so a genuine crossing is still reported as one: a flat ring is the residue the crossing
  // test cannot see on its own. With exactly three vertices every segment pair shares an endpoint
  // and is skipped, so three points on a line would otherwise pass as a zero-area warehouse.
  if (doubleSignedArea(points) === 0) {
    throw new InvalidWarehouseFootprintException(FLAT_FOOTPRINT_MESSAGE)
  }
}

/**
 * How far off an edge a point may sit and still count as being on it, in degrees.
 *
 * Exact collinearity is the wrong test here: `cross` is computed from differences of coordinates
 * around 50 degrees, so a point an operator placed *on* an edge lands within ~1e-14 degrees of it,
 * never exactly on it. This tolerance is about 0.1 mm on the ground — five orders of magnitude
 * above that arithmetic noise and far below any placement precision the site can mean.
 */
const ON_BOUNDARY_TOLERANCE_DEGREES = 1e-9

/** True when the point lies on the segment, within the tolerance above. */
function isOnSegment(point: FootprintPoint, start: FootprintPoint, end: FootprintPoint) {
  const length = Math.hypot(end.longitude - start.longitude, end.latitude - start.latitude)

  if (length === 0) {
    return samePoint(point, start)
  }

  // |cross| is twice the triangle's area, so dividing by the base gives the perpendicular distance.
  const distance = Math.abs(cross(start, end, point)) / length

  return distance <= ON_BOUNDARY_TOLERANCE_DEGREES && isBetween(point, start, end)
}

/** True when the point lies on one of the ring's edges, closing edge included. */
const onBoundary = (points: FootprintPoint[], point: FootprintPoint) =>
  points.some((start, index) => isOnSegment(point, start, points[(index + 1) % points.length]))

/**
 * True when the point lies inside the ring or exactly on its boundary.
 *
 * The boundary is tested first and on purpose: an even-odd ray cast is undefined for a point sitting
 * on an edge, and the domain makes that position a contained one — a warehouse door is placed
 * "within or on the boundary" of its warehouse footprint (`CONTEXT.md`, Warehouse Door GPS Location).
 *
 * The cast itself sends a ray toward increasing longitude and counts the edges it crosses, with the
 * half-open latitude comparison that makes a ray passing exactly through a vertex count once rather
 * than twice. Pure and dependency-free like the rest of this module, and independent of the ring's
 * winding direction.
 */
export function containsPoint(points: FootprintPoint[], point: FootprintPoint) {
  if (onBoundary(points, point)) {
    return true
  }

  let inside = false

  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const current = points[index]
    const other = points[previous]
    const straddlesRay = current.latitude > point.latitude !== other.latitude > point.latitude

    if (!straddlesRay) {
      continue
    }

    const crossingLongitude =
      ((other.longitude - current.longitude) * (point.latitude - current.latitude)) /
        (other.latitude - current.latitude) +
      current.longitude

    if (point.longitude < crossingLongitude) {
      inside = !inside
    }
  }

  return inside
}
