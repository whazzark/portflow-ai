import { formatShiftDay, formatShiftDuration } from '@/features/discharges/discharge-detail-view'

type CalendarShift = {
  id: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  plannedStartAt: string | null
  plannedEndAt: string | null
}

const DAY_MS = 24 * 3_600_000

/** A calendar always shows a week, however short the discharge. */
const MIN_DAYS = 7

/** A period drawn on the calendar snaps to this step, fine enough to need no correction most often. */
export const DRAW_STEP_MINUTES = 30

/** Twelve marks a day keep an hour readable without crowding a column's gutter. */
const HOUR_MARK_STEP = 2

/** A shift card's measures: its border and padding, one line of content, and the gap between. */
const BLOCK_CHROME_PX = 2 + 16
const BLOCK_ROW_PX = 20
const BLOCK_ROW_GAP_PX = 4
/** Times, status, responsible, resource counts: every line a shift card has. */
const BLOCK_ROWS = 4

/**
 * How many of a shift card's lines fit in its height, in order of importance. The times always
 * show, even when they are cut.
 */
export function blockRowCount(heightPx: number) {
  const fitting = Math.floor(
    (heightPx - BLOCK_CHROME_PX + BLOCK_ROW_GAP_PX) / (BLOCK_ROW_PX + BLOCK_ROW_GAP_PX),
  )

  return Math.min(BLOCK_ROWS, Math.max(1, fitting))
}

/**
 * The shift the calendar brings into view when none is open: the one under way, else the next to
 * prepare, else the last one worked. Shifts come in planned order, so the first match is the
 * earliest.
 */
export function defaultShiftId(shifts: CalendarShift[]) {
  const shift =
    shifts.find((candidate) => candidate.status === 'ACTIVE') ??
    shifts.find((candidate) => candidate.status === 'PLANNED') ??
    shifts.at(-1)

  return shift?.id ?? null
}

/**
 * The period a gesture on the calendar draws, between the instant it pressed and the one it
 * released, in either order. A press released where it began marks only a start, and lasts as long
 * as the last shift when there is one to follow.
 */
export function drawnPeriod(from: number, to: number, fallbackDurationMs: number | null) {
  if (from === to) {
    return {
      plannedStartAt: new Date(from).toISOString(),
      plannedEndAt: fallbackDurationMs ? new Date(from + fallbackDurationMs).toISOString() : null,
    }
  }

  return {
    plannedStartAt: new Date(Math.min(from, to)).toISOString(),
    plannedEndAt: new Date(Math.max(from, to)).toISOString(),
  }
}

/** The shift an address opens in the panel; none when it names none of these shifts. */
export function openShift<S extends CalendarShift>(shifts: S[], shiftId: string | undefined) {
  return shiftId === undefined ? undefined : shifts.find((shift) => shift.id === shiftId)
}

/** How far into its day an instant's clock reads, as a percentage, as the hour gutter reads it. */
function clockPct(instant: number) {
  const date = new Date(instant)
  const minutes =
    date.getHours() * 60 +
    date.getMinutes() +
    date.getSeconds() / 60 +
    date.getMilliseconds() / 60_000

  return (minutes / (24 * 60)) * 100
}

function startOfDay(instant: number) {
  const date = new Date(instant)
  date.setHours(0, 0, 0, 0)

  return date.getTime()
}

/**
 * Where each part of the shift calendar sits, in the browser's zone like every other date on the
 * page. The calendar reads as a week at least, one column per day from midnight to midnight,
 * opening on the day of the first shift or of the expected start when that comes first. A shift
 * worked past midnight is cut at it, its first piece standing for the whole shift. Positions are
 * percentages of a column's height. `null` when there is no shift to place.
 */
export function shiftCalendar<S extends CalendarShift>(
  discharge: { expectedStartAt: string | null; shifts: S[] },
  now?: Date,
) {
  // The transport types a planned period as nullable, although a shift always has one; a shift
  // without it would have nowhere in the calendar to go.
  const periods = discharge.shifts.flatMap((shift) =>
    shift.plannedStartAt && shift.plannedEndAt
      ? [{ shift, start: Date.parse(shift.plannedStartAt), end: Date.parse(shift.plannedEndAt) }]
      : [],
  )
  if (periods.length === 0) {
    return null
  }

  const firstStart = Math.min(...periods.map((period) => period.start))
  const lastEnd = Math.max(...periods.map((period) => period.end))
  const expectedStart = discharge.expectedStartAt
    ? Date.parse(discharge.expectedStartAt)
    : Number.NaN
  const anchor = startOfDay(
    Number.isNaN(expectedStart) ? firstStart : Math.min(expectedStart, firstStart),
  )

  // Days are counted on the calendar rather than in 24 hours, so a change of clocks never moves
  // a column off midnight. Instants are placed by the clock, as the hour gutter beside them reads:
  // on such a day the hour the clocks skip stays empty, and the hour they repeat is drawn once.
  const dayStart = (column: number) => {
    const date = new Date(anchor)
    date.setDate(date.getDate() + column)

    return date.getTime()
  }
  const place = (instant: number) => {
    const column = Math.round((startOfDay(instant) - anchor) / DAY_MS)

    return { column, pct: clockPct(instant), dayEnd: dayStart(column + 1) }
  }

  // A period cut at every midnight it crosses, each piece measured within its own column.
  const pieces = (start: number, end: number) => {
    const result: Array<{ column: number; topPct: number; heightPct: number }> = []
    let from = start
    do {
      const { column, pct, dayEnd } = place(from)
      const to = Math.min(end, dayEnd)
      const toPct = to === dayEnd ? 100 : clockPct(to)
      // A piece within the hour the clocks repeat may read backwards; it keeps no height.
      result.push({ column, topPct: pct, heightPct: Math.max(0, toPct - pct) })
      from = to
    } while (from < end)

    return result
  }

  const expectedStartPlace = Number.isNaN(expectedStart) ? null : place(expectedStart)
  const lastEndPlace = place(lastEnd)
  // The days the discharge itself covers; a shift ending at midnight does not reach the next one.
  const dischargeDays = Math.max(
    lastEndPlace.column + (lastEndPlace.pct > 0 ? 1 : 0),
    (expectedStartPlace?.column ?? 0) + 1,
  )
  const columnCount = Math.max(MIN_DAYS, dischargeDays)

  const columns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    // Only the discharge's own days are numbered, not those filling out the week.
    label: index < dischargeDays ? `Day ${index + 1}` : null,
    startLabel: formatShiftDay(new Date(dayStart(index))),
  }))

  const segments = periods.flatMap(({ shift, start, end }) => {
    const shiftPieces = pieces(start, end)

    return shiftPieces.map((piece, index) => ({
      shift,
      ...piece,
      primary: index === 0,
      continuesFromPrevious: index > 0,
      continuesToNext: index < shiftPieces.length - 1,
    }))
  })

  // The time between one shift's end and the next one's start, measured from the latest end so
  // far, so overlapping shifts never produce a break. A break cut at midnight reads its duration
  // once, in its tallest piece, where the label has the most room.
  const breaks: Array<{
    column: number
    topPct: number
    heightPct: number
    /** The shift the break comes before. */
    shiftId: string
    /** The whole break, as instants, whichever piece this is. */
    start: number
    end: number
    duration: string
    labelled: boolean
  }> = []
  let latestEnd: number | null = null
  for (const period of [...periods].sort((a, b) => a.start - b.start)) {
    if (latestEnd !== null && period.start > latestEnd) {
      const breakStart = latestEnd
      const breakPieces = pieces(breakStart, period.start)
      const tallest = breakPieces.reduce(
        (best, piece, index) => (piece.heightPct > breakPieces[best].heightPct ? index : best),
        0,
      )
      const duration =
        formatShiftDuration({
          plannedStartAt: new Date(breakStart).toISOString(),
          plannedEndAt: new Date(period.start).toISOString(),
        }) ?? ''
      breaks.push(
        ...breakPieces.map((piece, index) => ({
          ...piece,
          shiftId: period.shift.id,
          start: breakStart,
          end: period.start,
          duration,
          labelled: index === tallest,
        })),
      )
    }
    latestEnd = latestEnd === null ? period.end : Math.max(latestEnd, period.end)
  }

  const hourMarks = Array.from({ length: 24 / HOUR_MARK_STEP }, (_, index) => ({
    pct: ((index * HOUR_MARK_STEP) / 24) * 100,
    label: `${String(index * HOUR_MARK_STEP).padStart(2, '0')}:00`,
  }))

  // The clock a point down a column reads, snapped to the drawing step. Counted on the clock like
  // every placement, so a day the clocks change keeps its step on the hour.
  const instantAt = (column: number, pct: number) => {
    const bounded = Math.min(Math.max(column, 0), columnCount - 1)
    const minutes = (Math.min(Math.max(pct, 0), 100) / 100) * 24 * 60
    const date = new Date(dayStart(bounded))
    date.setHours(0, Math.round(minutes / DRAW_STEP_MINUTES) * DRAW_STEP_MINUTES)

    return date.getTime()
  }

  const nowInstant = now?.getTime()
  const nowPlace = nowInstant === undefined ? null : place(nowInstant)

  return {
    columns,
    segments,
    breaks,
    hourMarks,
    instantAt,
    periodPieces: pieces,
    // Only worth a line when the calendar does not already open on it.
    expectedStart:
      expectedStartPlace && expectedStart !== anchor
        ? { column: expectedStartPlace.column, pct: expectedStartPlace.pct }
        : null,
    now:
      nowPlace && nowPlace.column >= 0 && nowPlace.column < columnCount
        ? { column: nowPlace.column, pct: nowPlace.pct }
        : null,
  }
}
