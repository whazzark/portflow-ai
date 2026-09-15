import { formatShiftDay, formatShiftTime } from '@/features/discharges/discharge-detail-view'

type CalendarShift = {
  id: string
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  plannedStartAt: string | null
  plannedEndAt: string | null
}

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** Twelve marks a day keep an hour readable without crowding a column's gutter. */
const HOUR_MARK_STEP = 2

/**
 * The shift a viewer arrives on: the one under way, else the next to prepare, else the last one
 * worked. Shifts come in planned order, so the first match is the earliest.
 */
export function defaultShiftId(shifts: CalendarShift[]) {
  const shift =
    shifts.find((candidate) => candidate.status === 'ACTIVE') ??
    shifts.find((candidate) => candidate.status === 'PLANNED') ??
    shifts.at(-1)

  return shift?.id ?? null
}

/** The shift an address opens, falling back to the default when it names none of these shifts. */
export function openShift<S extends CalendarShift>(shifts: S[], shiftId: string | undefined) {
  const id = shifts.some((shift) => shift.id === shiftId) ? shiftId : defaultShiftId(shifts)

  return shifts.find((shift) => shift.id === id)
}

function floorToHour(instant: number) {
  const date = new Date(instant)
  date.setMinutes(0, 0, 0)

  return date.getTime()
}

/**
 * Where each part of the shift calendar sits, in the browser's zone like every other date on the
 * page. The calendar reads in columns of 24 hours, each opening at the hour the discharge is
 * expected to start, so a night shift stays one block on a discharge started in the morning. It
 * reaches back to an earlier shift's hour rather than hiding it. Positions are percentages of a
 * column's height. `null` when there is no shift to place.
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
  const anchor = floorToHour(
    Number.isNaN(expectedStart) ? firstStart : Math.min(expectedStart, firstStart),
  )

  const pctOfDay = (duration: number) => (duration / DAY_MS) * 100
  const place = (instant: number) => {
    const column = Math.floor((instant - anchor) / DAY_MS)

    return { column, pct: pctOfDay(instant - anchor - column * DAY_MS) }
  }

  // A period cut at every column edge it crosses, each piece measured within its own column.
  const pieces = (start: number, end: number) => {
    const result: Array<{ column: number; topPct: number; heightPct: number }> = []
    let from = start
    do {
      const { column, pct } = place(from)
      const to = Math.min(end, anchor + (column + 1) * DAY_MS)
      result.push({ column, topPct: pct, heightPct: pctOfDay(to - from) })
      from = to
    } while (from < end)

    return result
  }

  const expectedStartPlace = Number.isNaN(expectedStart) ? null : place(expectedStart)
  const columnCount = Math.max(
    1,
    Math.ceil((lastEnd - anchor) / DAY_MS),
    (expectedStartPlace?.column ?? 0) + 1,
  )

  const columns = Array.from({ length: columnCount }, (_, index) => {
    const start = new Date(anchor + index * DAY_MS)

    return {
      index,
      label: `Day ${index + 1}`,
      startLabel: `${formatShiftDay(start)} ${formatShiftTime(start.toISOString())}`,
    }
  })

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
  // far, so overlapping shifts never produce a break.
  const breaks: Array<{ column: number; topPct: number; heightPct: number }> = []
  let latestEnd: number | null = null
  for (const period of [...periods].sort((a, b) => a.start - b.start)) {
    if (latestEnd !== null && period.start > latestEnd) {
      breaks.push(...pieces(latestEnd, period.start))
    }
    latestEnd = latestEnd === null ? period.end : Math.max(latestEnd, period.end)
  }

  const hourMarks = Array.from({ length: 24 / HOUR_MARK_STEP }, (_, index) => {
    const mark = new Date(anchor + index * HOUR_MARK_STEP * HOUR_MS)

    return {
      pct: pctOfDay(index * HOUR_MARK_STEP * HOUR_MS),
      label: `${String(mark.getHours()).padStart(2, '0')}:00`,
    }
  })

  const end = anchor + columnCount * DAY_MS
  const nowInstant = now?.getTime()

  return {
    columns,
    segments,
    breaks,
    hourMarks,
    // Only worth a line when the calendar does not already open on it.
    expectedStart: expectedStartPlace && expectedStart !== anchor ? expectedStartPlace : null,
    now:
      nowInstant !== undefined && nowInstant >= anchor && nowInstant < end
        ? place(nowInstant)
        : null,
  }
}
