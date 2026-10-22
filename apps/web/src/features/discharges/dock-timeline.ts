import { plannedPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** Either side of an expected start while no shift says when the discharge works. */
const UNPLANNED_HALF_SPAN = 12 * HOUR
/** The span runs past the plan by a tenth of its length, so its edges are never on the frame. */
const PADDING_RATIO = 0.1
const MIN_PADDING = 2 * HOUR

type Occupation = DischargeDetailDto['dockOccupations'][number]

export type TimelineOccupation = {
  dischargeId: string
  vesselName: string
  status: Occupation['status']
  startAt: number
  /** `null` when the discharge holds the dock with no later end planned. */
  endAt: number | null
  /** Positions on the span, from 0 to 1, clamped to its edges. */
  from: number
  to: number
  clippedStart: boolean
  clippedEnd: boolean
  openEnded: boolean
  /** A planned discharge with no shift has only its expected start. */
  pointOnly: boolean
  overlapsPlannedPeriod: boolean
  /**
   * An active discharge ending before the span: kept, since it holds the dock now and is why a
   * start would be refused, but not drawn and not counted against the period.
   */
  outsideSpan: boolean
}

export type DockTimeline = {
  span: { startAt: number; endAt: number }
  now: { kind: 'INSIDE'; at: number; position: number } | { kind: 'BEFORE' } | { kind: 'AFTER' }
  expectedStart: { at: number; position: number }
  shifts: Array<{ id: string; startAt: number; endAt: number; from: number; to: number }>
  gaps: Array<{ startAt: number; endAt: number; durationMinutes: number; from: number; to: number }>
  occupations: TimelineOccupation[]
  dockFree: boolean
}

/** Two intervals share time; an instant shares it with an interval holding it. */
function intersects(left: [number, number], right: [number, number]) {
  const instant = left[0] === left[1] || right[0] === right[1]

  return instant
    ? left[0] <= right[1] && right[0] <= left[1]
    : left[0] < right[1] && right[0] < left[1]
}

/**
 * Where a planned discharge's dock stands around its plan: the span drawn, now and the expected
 * start on it, the discharge's shifts and the gaps between them, and the other discharges the dock
 * is promised to over that span. Pure, so the drawing only places what this decides.
 */
export function dockTimeline(detail: DischargeDetailDto, now: number): DockTimeline {
  const expectedStart = Date.parse(detail.expectedStartAt ?? '')
  const period = plannedPeriod(detail.shifts)
  const plan: [number, number] = period
    ? [Date.parse(period.plannedStartAt), Date.parse(period.plannedEndAt)]
    : [expectedStart, expectedStart]
  const frame: [number, number] = period
    ? plan
    : [expectedStart - UNPLANNED_HALF_SPAN, expectedStart + UNPLANNED_HALF_SPAN]
  const padding = Math.max((frame[1] - frame[0]) * PADDING_RATIO, MIN_PADDING)
  const span = { startAt: frame[0] - padding, endAt: frame[1] + padding }
  const position = (instant: number) =>
    Math.min(1, Math.max(0, (instant - span.startAt) / (span.endAt - span.startAt)))

  const shifts = detail.shifts
    .flatMap((shift) =>
      shift.plannedStartAt && shift.plannedEndAt
        ? [
            {
              id: shift.id,
              startAt: Date.parse(shift.plannedStartAt),
              endAt: Date.parse(shift.plannedEndAt),
            },
          ]
        : [],
    )
    .sort((left, right) => left.startAt - right.startAt || left.endAt - right.endAt)
    .map((shift) => ({ ...shift, from: position(shift.startAt), to: position(shift.endAt) }))

  // A gap is time no shift covers: measured from the latest end so far, so a shift overlapping the
  // previous one, or starting as it ends, leaves none.
  const gaps: DockTimeline['gaps'] = []
  let coveredUntil: number | null = null
  for (const shift of shifts) {
    if (coveredUntil !== null && shift.startAt > coveredUntil) {
      gaps.push({
        startAt: coveredUntil,
        endAt: shift.startAt,
        durationMinutes: Math.round((shift.startAt - coveredUntil) / MINUTE),
        from: position(coveredUntil),
        to: position(shift.startAt),
      })
    }
    coveredUntil = Math.max(coveredUntil ?? shift.endAt, shift.endAt)
  }

  const occupations = detail.dockOccupations.flatMap((occupation): TimelineOccupation[] => {
    const interval = occupationInterval(occupation, now)
    // An open end runs on past the span: that is what holding the dock with no end planned means.
    const end = interval.endAt ?? Math.max(span.endAt, interval.startAt)
    const inSpan = intersects([interval.startAt, end], [span.startAt, span.endAt])
    if (!inSpan && occupation.status !== 'ACTIVE') {
      return []
    }

    return [
      {
        dischargeId: occupation.dischargeId,
        vesselName: occupation.vesselName,
        status: occupation.status,
        startAt: interval.startAt,
        endAt: interval.endAt,
        from: position(interval.startAt),
        to: position(end),
        clippedStart: interval.startAt < span.startAt,
        clippedEnd: interval.endAt === null || interval.endAt > span.endAt,
        openEnded: interval.endAt === null,
        pointOnly: interval.pointOnly,
        overlapsPlannedPeriod: intersects(
          [interval.startAt, interval.endAt ?? Number.POSITIVE_INFINITY],
          plan,
        ),
        outsideSpan: !inSpan,
      },
    ]
  })

  return {
    span,
    now:
      now < span.startAt
        ? { kind: 'BEFORE' }
        : now > span.endAt
          ? { kind: 'AFTER' }
          : { kind: 'INSIDE', at: now, position: position(now) },
    expectedStart: { at: expectedStart, position: position(expectedStart) },
    shifts,
    gaps,
    occupations,
    dockFree: occupations.every((occupation) => occupation.outsideSpan),
  }
}

/**
 * The time another discharge holds the dock for: an active one from its start to its planned end,
 * or with no end once that end has passed, since it holds the dock until it is closed; a planned one
 * over its planned period, or at its expected start while it has no shift.
 */
function occupationInterval(occupation: Occupation, now: number) {
  const plannedStart = occupation.plannedStartAt ? Date.parse(occupation.plannedStartAt) : null
  const plannedEnd = occupation.plannedEndAt ? Date.parse(occupation.plannedEndAt) : null

  if (occupation.status === 'ACTIVE') {
    const startAt = Date.parse(occupation.startedAt ?? occupation.expectedStartAt ?? '')

    return {
      startAt,
      endAt: plannedEnd !== null && plannedEnd > Math.max(startAt, now) ? plannedEnd : null,
      pointOnly: false,
    }
  }

  if (plannedStart !== null && plannedEnd !== null) {
    return { startAt: plannedStart, endAt: plannedEnd, pointOnly: false }
  }

  const expected = Date.parse(occupation.expectedStartAt ?? '')

  return { startAt: expected, endAt: expected, pointOnly: true }
}
