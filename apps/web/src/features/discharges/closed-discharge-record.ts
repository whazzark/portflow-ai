import { formatShiftPeriod, sumTonnes } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

type ClosedDetail = Pick<DischargeDetailDto, 'startedAt' | 'shifts'>

/**
 * When a closed discharge ran: from its recorded start, else its earliest shift's actual start, to
 * its closure time. Discharge Closure (#98) records that time; until a closure time is passed in,
 * the end stays unknown rather than being inferred from shifts or truck releases.
 */
export function closedRecordPeriod(detail: ClosedDetail, closedAt: string | null = null) {
  const actualStarts = detail.shifts
    .map((shift) => shift.actualStartAt)
    .filter((startAt): startAt is string => startAt !== null)
    .sort((first, second) => Date.parse(first) - Date.parse(second))

  return { startAt: detail.startedAt ?? actualStarts[0] ?? null, endAt: closedAt }
}

const startOfDay = (instant: number) => {
  const date = new Date(instant)

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const nextDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)

/**
 * A closed discharge's shifts on a strip of whole local days, as fractions of its width. Each shift
 * runs from its actual start, else its planned start, to its planned end: shifts record no actual
 * end. One started after its planned end is a mark at its start rather than a negative stretch. It
 * is a record, so it knows nothing of now, of planning, or of other discharges.
 */
export function closedDockTimeline(detail: ClosedDetail) {
  const shifts = detail.shifts
    .flatMap((shift) => {
      const startAt = shift.actualStartAt ?? shift.plannedStartAt
      // The transport types the planned period as nullable, although a shift always has one.
      if (!startAt || !shift.plannedEndAt) {
        return []
      }

      const start = Date.parse(startAt)
      const end = Math.max(Date.parse(shift.plannedEndAt), start)
      const endAt = end === start ? startAt : shift.plannedEndAt

      return [{ shift, startAt, endAt, start, end }]
    })
    .sort((first, second) => first.start - second.start)

  if (shifts.length === 0) {
    return null
  }

  const axisStart = startOfDay(Math.min(...shifts.map(({ start }) => start)))
  const lastEnd = Math.max(...shifts.map(({ end }) => end))
  const lastDay = startOfDay(lastEnd)
  // Ending at a midnight closes on that day, unless the strip would then have no day at all.
  const axisEnd = lastDay.getTime() === lastEnd && lastDay > axisStart ? lastDay : nextDay(lastDay)
  const span = axisEnd.getTime() - axisStart.getTime()
  const offsetOf = (instant: number) => (instant - axisStart.getTime()) / span

  const days: { date: Date; offset: number }[] = []
  for (let day = axisStart; day < axisEnd; day = nextDay(day)) {
    days.push({ date: day, offset: offsetOf(day.getTime()) })
  }

  const { startAt } = closedRecordPeriod(detail)
  const started = startAt === null ? null : offsetOf(Date.parse(startAt))

  return {
    axisStart,
    axisEnd,
    days,
    blocks: shifts.map(({ shift, startAt, endAt, start, end }) => ({
      shiftId: shift.id,
      startAt,
      endAt,
      offset: offsetOf(start),
      width: (end - start) / span,
      label: formatShiftPeriod(shift),
    })),
    startedMarker: started !== null && started >= 0 && started <= 1 ? started : null,
  }
}

type SummaryDetail = Pick<DischargeDetailDto, 'shifts' | 'productLots' | 'truckPool'>
type WarehouseDoor =
  DischargeDetailDto['productLots'][number]['doorAssignments'][number]['warehouseDoor']

/** What a closed discharge involved, as its Overview sums it up. */
export function closedDischargeSummary(detail: SummaryDetail) {
  const doors = new Map<string, WarehouseDoor>()
  for (const lot of detail.productLots) {
    for (const assignment of lot.doorAssignments) {
      doors.set(assignment.warehouseDoor.id, assignment.warehouseDoor)
    }
  }

  const releases = detail.truckPool.map((entry) => entry.releasedAt)
  const isRecorded = (releasedAt: string | null) => releasedAt !== null
  // A pool still holding a truck, or one that never held any, was not released as a whole.
  const allReleasedAt =
    releases.length > 0 &&
    releases.every((releasedAt): releasedAt is string => isRecorded(releasedAt))
      ? releases.reduce((latest, releasedAt) =>
          Date.parse(releasedAt) > Date.parse(latest) ? releasedAt : latest,
        )
      : null

  return {
    shifts: detail.shifts.length,
    lots: detail.productLots.length,
    customers: new Set(detail.productLots.map((lot) => lot.customer.id)).size,
    expectedTotal:
      sumTonnes(detail.productLots.map((lot) => lot.expectedQuantityTonnes)) ?? '0.000',
    doors: [...doors.values()].sort((first, second) => first.name.localeCompare(second.name)),
    trucks: new Set(detail.truckPool.map((entry) => entry.truckId)).size,
    allReleasedAt,
  }
}
