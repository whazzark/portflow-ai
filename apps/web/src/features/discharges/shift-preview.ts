import { fromDateTimeLocalValue } from '@/helpers/dates'

/** Another discharge holding the dock, as the occupancy read answers it. */
export type PreviewOccupancy = {
  discharge: { id: string; vesselName: string; status: 'PLANNED' | 'ACTIVE' }
  startAt: string
  endAt: string
}

type DraftShift = { plannedStartAt: string; plannedEndAt: string }

const DAY_MS = 24 * 3_600_000

/** A preview always shows a week, however short the discharge. */
const MIN_DAYS = 7

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' })

/** A day as the preview's columns and occupancy ends read it: `Tue 22`. */
export function formatPreviewDay(instant: number | string) {
  return DAY_LABEL.format(new Date(instant))
}

function startOfDay(instant: number) {
  const date = new Date(instant)
  date.setHours(0, 0, 0, 0)

  return date.getTime()
}

/** The instant a local date-time field holds, or `NaN` while it holds none. */
function parseLocal(value: string) {
  return Date.parse(fromDateTimeLocalValue(value) ?? '')
}

/** A duration to the minute, as the shift rows read it: `8 h`, `7 h 30 min`, `45 min`. */
function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const rest = total % 60

  return [hours > 0 && `${hours} h`, rest > 0 && `${rest} min`].filter(Boolean).join(' ') || '0 h'
}

/**
 * Where each part of the creation's shift preview sits, as percentages of a period of whole local
 * days, in the browser's zone like the date fields it reads from.
 *
 * The period opens the day before the dock frees up for this discharge, so the other discharge
 * leaving stays in view, or else on the earlier of the expected start and the first shift. It runs
 * to the later of the expected start and the last shift's end, and is padded forward to a week.
 * Occupancy is `null` while it loads or when it failed: everything else is still laid out.
 */
export function shiftPreview({
  expectedStartAt,
  shifts,
  occupancy,
}: {
  expectedStartAt: string
  shifts: DraftShift[]
  occupancy: PreviewOccupancy[] | null
}) {
  const expectedStart = parseLocal(expectedStartAt)
  // A shift is placed once its period is whole and runs forward, the rule the footer's period reads.
  const periods = shifts.flatMap((shift, index) => {
    const start = parseLocal(shift.plannedStartAt)
    const end = parseLocal(shift.plannedEndAt)

    return Number.isNaN(start) || Number.isNaN(end) || end <= start
      ? []
      : [{ number: index + 1, start, end }]
  })
  const scheduled = new Set(periods.map((period) => period.number))
  const unscheduled = shifts.flatMap((_, index) => (scheduled.has(index + 1) ? [] : [index + 1]))

  const occupancies = (occupancy ?? []).map((item) => ({
    item,
    start: Date.parse(item.startAt),
    end: Date.parse(item.endAt),
  }))
  // The dock frees up once every discharge already there by the expected start has left.
  const holdersBefore = Number.isNaN(expectedStart)
    ? []
    : occupancies.filter(({ start }) => start < expectedStart)
  const freeFrom =
    holdersBefore.length === 0 ? null : Math.max(...holdersBefore.map(({ end }) => end))

  const opening = [
    ...(Number.isNaN(expectedStart) ? [] : [expectedStart]),
    ...periods.map((period) => period.start),
  ]
  const firstDayCandidates = [...(freeFrom === null ? [] : [startOfDay(freeFrom) - 1]), ...opening]
  const anchor = startOfDay(
    firstDayCandidates.length === 0 ? Date.now() : Math.min(...firstDayCandidates),
  )

  // Days are counted on the calendar rather than in 24 hours, so a change of clocks never moves
  // a day off midnight.
  const dayStart = (index: number) => {
    const date = new Date(anchor)
    date.setDate(date.getDate() + index)

    return date.getTime()
  }
  const dayIndex = (instant: number) => Math.round((startOfDay(instant) - anchor) / DAY_MS)
  // An end exactly at midnight belongs to the day it closes, not the one it opens.
  const closing = [
    ...(Number.isNaN(expectedStart) ? [] : [expectedStart]),
    ...periods.map((period) => period.end - 1),
  ]
  const lastDay = closing.length === 0 ? 0 : Math.max(...closing.map(dayIndex))
  const dayCount = Math.max(MIN_DAYS, lastDay + 1)

  const days = Array.from({ length: dayCount }, (_, index) => {
    const start = dayStart(index)

    return { start, label: formatPreviewDay(start) }
  })
  const periodStart = days[0].start
  const periodEnd = dayStart(dayCount)
  const pct = (instant: number) => ((instant - periodStart) / (periodEnd - periodStart)) * 100
  const span = (start: number, end: number) => {
    const from = Math.max(start, periodStart)
    const to = Math.min(end, periodEnd)

    return { leftPct: pct(from), widthPct: pct(to) - pct(from) }
  }

  const shown = occupancies.filter(({ start, end }) => end > periodStart && start < periodEnd)
  const placedOccupancies = shown.map(({ item, start, end }) => ({
    discharge: item.discharge,
    startAt: item.startAt,
    endAt: item.endAt,
    ...span(start, end),
    clippedStart: start < periodStart,
    clippedEnd: end > periodEnd,
  }))

  // The dock is free wherever no occupancy covers it, overlapping occupancies read as one.
  const freeGaps: Array<{ leftPct: number; widthPct: number }> = []
  if (occupancy !== null) {
    let cursor = periodStart
    for (const { start, end } of [...shown].sort((a, b) => a.start - b.start)) {
      if (start > cursor) {
        freeGaps.push(span(cursor, start))
      }
      cursor = Math.max(cursor, end)
    }
    if (cursor < periodEnd) {
      freeGaps.push(span(cursor, periodEnd))
    }
  }

  // The time between one shift's end and the next one's start, measured from the latest end so
  // far, so overlapping shifts never produce a break.
  const breaks: Array<{ leftPct: number; widthPct: number }> = []
  let latestEnd: number | null = null
  for (const period of [...periods].sort((a, b) => a.start - b.start)) {
    if (latestEnd !== null && period.start > latestEnd) {
      breaks.push(span(latestEnd, period.start))
    }
    latestEnd = latestEnd === null ? period.end : Math.max(latestEnd, period.end)
  }

  const totalMinutes = periods.reduce(
    (sum, period) => sum + Math.round((period.end - period.start) / 60_000),
    0,
  )

  return {
    days,
    freeFrom: freeFrom === null ? null : new Date(freeFrom).toISOString(),
    occupancies: placedOccupancies,
    freeGaps,
    expectedStart: Number.isNaN(expectedStart)
      ? null
      : { at: new Date(expectedStart).toISOString(), leftPct: pct(expectedStart) },
    shifts: periods.map((period) => ({
      number: period.number,
      startAt: new Date(period.start).toISOString(),
      endAt: new Date(period.end).toISOString(),
      ...span(period.start, period.end),
    })),
    breaks,
    unscheduled,
    summary:
      periods.length === 0
        ? null
        : { count: periods.length, duration: formatMinutes(totalMinutes) },
  }
}
