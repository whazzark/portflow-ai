import type { WarehouseDoorDto, WarehousePoint } from '@/features/warehouses/types'

export const MINIMUM_FOOTPRINT_POINTS = 3

export type FootprintProblem =
  | 'TOO_FEW_POINTS'
  | 'DUPLICATE_POINT'
  | 'SELF_INTERSECTING'
  | 'FLAT_OUTLINE'

/** Longitude is the x axis and latitude the y axis. Mirrors the authoritative server-side rule in
 * `apps/api/app/warehouses/shared/footprint_geometry.ts`; the API remains the enforcement point and
 * this copy only spares the administrator a round-trip (`research.md` R6). */
const cross = (origin: WarehousePoint, a: WarehousePoint, b: WarehousePoint) =>
  (a.longitude - origin.longitude) * (b.latitude - origin.latitude) -
  (a.latitude - origin.latitude) * (b.longitude - origin.longitude)

const samePoint = (a: WarehousePoint, b: WarehousePoint) =>
  a.latitude === b.latitude && a.longitude === b.longitude

/** Twice the signed area of the ring (the shoelace sum). Zero means every vertex sits on one line,
 * so the outline encloses nothing. */
const doubleSignedArea = (points: WarehousePoint[]) =>
  points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length]
    return total + (point.longitude * next.latitude - next.longitude * point.latitude)
  }, 0)

const isBetween = (point: WarehousePoint, start: WarehousePoint, end: WarehousePoint) =>
  Math.min(start.longitude, end.longitude) <= point.longitude &&
  point.longitude <= Math.max(start.longitude, end.longitude) &&
  Math.min(start.latitude, end.latitude) <= point.latitude &&
  point.latitude <= Math.max(start.latitude, end.latitude)

function segmentsIntersect(
  firstStart: WarehousePoint,
  firstEnd: WarehousePoint,
  secondStart: WarehousePoint,
  secondEnd: WarehousePoint,
) {
  const d1 = cross(firstStart, firstEnd, secondStart)
  const d2 = cross(firstStart, firstEnd, secondEnd)
  const d3 = cross(secondStart, secondEnd, firstStart)
  const d4 = cross(secondStart, secondEnd, firstEnd)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  return (
    (d1 === 0 && isBetween(secondStart, firstStart, firstEnd)) ||
    (d2 === 0 && isBetween(secondEnd, firstStart, firstEnd)) ||
    (d3 === 0 && isBetween(firstStart, secondStart, secondEnd)) ||
    (d4 === 0 && isBetween(firstEnd, secondStart, secondEnd))
  )
}

/** Returns the first problem that would make this footprint unacceptable, or `null` when it forms a
 * simple ring of at least three points. The closing edge is implied and must not be drawn. */
export function checkFootprint(points: WarehousePoint[]): FootprintProblem | null {
  if (points.length < MINIMUM_FOOTPRINT_POINTS) {
    return 'TOO_FEW_POINTS'
  }

  for (let index = 0; index < points.length; index += 1) {
    if (samePoint(points[index], points[(index + 1) % points.length])) {
      return 'DUPLICATE_POINT'
    }
  }

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (second === first + 1 || (first === 0 && second === points.length - 1)) {
        continue
      }

      if (
        segmentsIntersect(
          points[first],
          points[(first + 1) % points.length],
          points[second],
          points[(second + 1) % points.length],
        )
      ) {
        return 'SELF_INTERSECTING'
      }
    }
  }

  // Last, so a genuine crossing is still reported as one: a flat ring is the residue the crossing
  // test cannot see on its own. With exactly three vertices every segment pair shares an endpoint
  // and is skipped, so three points on a line would otherwise read as a valid footprint.
  if (doubleSignedArea(points) === 0) {
    return 'FLAT_OUTLINE'
  }

  return null
}

export const isSubmittableFootprint = (points: WarehousePoint[]) => checkFootprint(points) === null

export const FOOTPRINT_PROBLEM_MESSAGES: Record<FootprintProblem, string> = {
  TOO_FEW_POINTS: 'A warehouse footprint needs at least three boundary points.',
  DUPLICATE_POINT: 'Two consecutive boundary points are identical. Move or remove one of them.',
  SELF_INTERSECTING: 'The footprint outline must not cross itself.',
  FLAT_OUTLINE: 'The boundary points are all in line, so the outline encloses no area.',
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
function isOnSegment(point: WarehousePoint, start: WarehousePoint, end: WarehousePoint) {
  const length = Math.hypot(end.longitude - start.longitude, end.latitude - start.latitude)

  if (length === 0) {
    return samePoint(point, start)
  }

  // |cross| is twice the triangle's area, so dividing by the base gives the perpendicular distance.
  const distance = Math.abs(cross(start, end, point)) / length

  return distance <= ON_BOUNDARY_TOLERANCE_DEGREES && isBetween(point, start, end)
}

/** True when the point lies on one of the ring's edges, closing edge included. */
const onBoundary = (points: WarehousePoint[], point: WarehousePoint) =>
  points.some((start, index) => isOnSegment(point, start, points[(index + 1) % points.length]))

/**
 * True when the point lies inside the ring or exactly on its boundary. Mirrors the authoritative
 * server-side `containsPoint` in `apps/api/app/warehouses/shared/footprint_geometry.ts`; the API
 * remains the enforcement point and this copy only spares the administrator a round-trip
 * (`research.md` R7).
 *
 * The boundary is tested first because an even-odd ray cast is undefined there, and the domain makes
 * that position a contained one: a door is placed within **or on** its warehouse footprint.
 */
export function isInsideFootprint(points: WarehousePoint[], point: WarehousePoint) {
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

/**
 * The doors the outline would leave outside, in their stored order. Lifecycle status is deliberately
 * ignored: an archived door keeps its recorded position inside its warehouse footprint, so letting
 * it fall outside would break the same invariant the check exists to protect (`research.md` R6).
 */
export const doorsOutsideFootprint = (points: WarehousePoint[], doors: WarehouseDoorDto[]) =>
  doors.filter((door) => !isInsideFootprint(points, door))
