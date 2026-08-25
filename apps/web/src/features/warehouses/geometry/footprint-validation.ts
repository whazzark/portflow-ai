import type { WarehousePoint } from '@/features/warehouses/types'

export const MINIMUM_FOOTPRINT_POINTS = 3

export type FootprintProblem = 'TOO_FEW_POINTS' | 'DUPLICATE_POINT' | 'SELF_INTERSECTING'

/** Longitude is the x axis and latitude the y axis. Mirrors the authoritative server-side rule in
 * `apps/api/app/warehouses/shared/footprint_geometry.ts`; the API remains the enforcement point and
 * this copy only spares the administrator a round-trip (`research.md` R6). */
const cross = (origin: WarehousePoint, a: WarehousePoint, b: WarehousePoint) =>
  (a.longitude - origin.longitude) * (b.latitude - origin.latitude) -
  (a.latitude - origin.latitude) * (b.longitude - origin.longitude)

const samePoint = (a: WarehousePoint, b: WarehousePoint) =>
  a.latitude === b.latitude && a.longitude === b.longitude

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

  return null
}

export const isSubmittableFootprint = (points: WarehousePoint[]) => checkFootprint(points) === null

export const FOOTPRINT_PROBLEM_MESSAGES: Record<FootprintProblem, string> = {
  TOO_FEW_POINTS: 'A warehouse footprint needs at least three boundary points.',
  DUPLICATE_POINT: 'Two consecutive boundary points are identical. Move or remove one of them.',
  SELF_INTERSECTING: 'The footprint outline must not cross itself.',
}
