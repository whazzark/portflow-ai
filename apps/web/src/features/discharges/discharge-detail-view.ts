import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime, fromDateTimeLocalValue } from '@/helpers/dates'

type DischargeStatus = DischargeDetailDto['status']

// The transport types every date as nullable, although an effective start never is in the column.
type Period = { effectiveFrom: string | null; effectiveTo: string | null }

/**
 * An assignment or a membership is in effect while its period has no end and its discharge is
 * still planned or active — the same two conditions the site-reference archival guards apply, so
 * the page never claims a discharge holds a resource those guards consider free. A closed
 * discharge holds nothing, even where one of its periods was left without an end.
 */
export function isInEffect(period: Pick<Period, 'effectiveTo'>, dischargeStatus: DischargeStatus) {
  return dischargeStatus !== 'CLOSED' && period.effectiveTo === null
}

/** Every period stays its own entry; this only decides which group it is read in. */
export function splitPeriods<T extends Pick<Period, 'effectiveTo'>>(
  periods: T[],
  dischargeStatus: DischargeStatus,
) {
  return {
    inEffect: periods.filter((period) => isInEffect(period, dischargeStatus)),
    ended: periods.filter((period) => !isInEffect(period, dischargeStatus)),
  }
}

/**
 * A lot's doors as its table cell shows them. The doors it holds are chips, all of them up to
 * `limit`, else one fewer and a `+N` for the rest, so a row stays one line high. Ended assignments
 * are history, reached apart. A closed discharge holds nothing, so its chips are the doors it used,
 * once each, and all its periods are its history.
 */
export function lotDoorCell<Assignment extends Period & { warehouseDoor: { id: string } }>(
  assignments: Assignment[],
  dischargeStatus: DischargeStatus,
  limit = 3,
) {
  const { inEffect, ended } = splitPeriods(assignments, dischargeStatus)
  const closed = dischargeStatus === 'CLOSED'
  const doors = closed
    ? assignments.filter(
        (assignment, index) =>
          assignments.findIndex(
            (candidate) => candidate.warehouseDoor.id === assignment.warehouseDoor.id,
          ) === index,
      )
    : inEffect
  const shown = doors.length <= limit ? doors : doors.slice(0, limit - 1)

  return {
    doors,
    shown,
    hidden: doors.slice(shown.length),
    history: ended,
    historyLabel: closed ? ('history' as const) : ('ended' as const),
  }
}

export type LotDoorNotice = 'NONE_ASSIGNED' | 'NONE_CURRENTLY_ASSIGNED'

/**
 * What a lot says about its doors beyond listing them. A closed discharge holds no door any more,
 * so its ended periods are history rather than a gap worth pointing out.
 */
export function lotDoorNotice(
  lot: { doorAssignments: Pick<Period, 'effectiveTo'>[] },
  dischargeStatus: DischargeStatus,
): LotDoorNotice | null {
  if (lot.doorAssignments.length === 0) {
    return 'NONE_ASSIGNED'
  }

  if (
    dischargeStatus === 'CLOSED' ||
    lot.doorAssignments.some((period) => isInEffect(period, dischargeStatus))
  ) {
    return null
  }

  return 'NONE_CURRENTLY_ASSIGNED'
}

const WHOLE_TONNES = new Intl.NumberFormat('en-GB')

/**
 * A fixed-3 decimal string as tonnes. The value never goes through a number: the whole part is
 * grouped as an integer and the three decimals are kept as sent. Belongs in `helpers/` once a
 * second feature displays tonnes.
 */
export function formatTonnes(value: string) {
  const [whole, decimals = '000'] = value.split('.')

  return `${WHOLE_TONNES.format(BigInt(whole))}.${decimals} t`
}

const TONNAGE_PATTERN = /^(\d{1,9})(?:\.(\d{1,3}))?$/

/**
 * The exact sum of the tonnages among `values` that are valid, as a fixed-3 decimal string, or
 * `null` when none is. Counted in thousandths of a tonne so no floating point is involved: this
 * previews the expected tonnage while a preparation is typed, and the API's own sum must match it.
 */
export function sumTonnes(values: string[]) {
  let thousandths = 0n
  let counted = 0

  for (const value of values) {
    const match = TONNAGE_PATTERN.exec(value.trim())
    if (!match) {
      continue
    }

    thousandths += BigInt(match[1]) * 1000n + BigInt((match[2] ?? '').padEnd(3, '0'))
    counted += 1
  }

  if (counted === 0) {
    return null
  }

  return `${thousandths / 1000n}.${String(thousandths % 1000n).padStart(3, '0')}`
}

const SHIFT_DAY = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const SHIFT_TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** A local day as the shift calendar and shift names read it: `Sun 4 Oct`. */
export function formatShiftDay(date: Date) {
  return SHIFT_DAY.format(date)
}

/** A shift's time of day, to the minute its planned period is entered with: `06:00`. */
export function formatShiftTime(iso: string | null) {
  return iso ? SHIFT_TIME.format(new Date(iso)) : '—'
}

/**
 * How a shift is named to users, everywhere it is named: its planned period, with the day once
 * when the shift starts and ends on the same local day, and on both ends when it runs past midnight.
 */
export function formatShiftPeriod(shift: {
  plannedStartAt: string | null
  plannedEndAt: string | null
}) {
  const { plannedStartAt, plannedEndAt } = shift
  // The transport types both as nullable, although a planned period always has them.
  if (!plannedStartAt || !plannedEndAt) {
    return `${formatDateTime(plannedStartAt)} – ${formatDateTime(plannedEndAt)}`
  }

  const start = new Date(plannedStartAt)
  const end = new Date(plannedEndAt)
  const endTime = formatShiftTime(plannedEndAt)
  const sameDay = start.toDateString() === end.toDateString()

  return `${formatShiftDay(start)} ${formatShiftTime(plannedStartAt)} – ${sameDay ? endTime : `${formatShiftDay(end)} ${endTime}`}`
}

type Named = { id: string; name: string }

type ShiftResources = {
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  trucks: Array<{ truckId: string; effectiveTo: string | null }>
  warehouseDoors: Array<{ warehouseDoor: Named; warehouse: Named; effectiveTo: string | null }>
  weighingAreas: Array<{ weighingArea: Named; effectiveTo: string | null }>
}

/**
 * The distinct trucks, warehouse doors, and weighing areas a shift counts: those in effect, or,
 * once the shift is finished and every period has ended, those it used. Each keeps the order its
 * first period comes in.
 */
export function shiftResources(shift: ShiftResources) {
  const distinct = <T extends { effectiveTo: string | null }, R>(
    periods: T[],
    idOf: (period: T) => string,
    pick: (period: T) => R,
  ) => {
    const byId = new Map<string, R>()
    for (const period of periods) {
      if (
        (shift.status === 'COMPLETED' || period.effectiveTo === null) &&
        !byId.has(idOf(period))
      ) {
        byId.set(idOf(period), pick(period))
      }
    }

    return [...byId.values()]
  }

  return {
    truckIds: distinct(
      shift.trucks,
      (truck) => truck.truckId,
      (truck) => truck.truckId,
    ),
    warehouseDoors: distinct(
      shift.warehouseDoors,
      (membership) => membership.warehouseDoor.id,
      (membership) => ({
        name: membership.warehouseDoor.name,
        warehouse: membership.warehouse.name,
      }),
    ),
    weighingAreas: distinct(
      shift.weighingAreas,
      (membership) => membership.weighingArea.id,
      (membership) => membership.weighingArea.name,
    ),
  }
}

/** How long a shift is planned to last, to the minute: `8 h`, `7 h 30 min`, `45 min`. */
export function formatShiftDuration(shift: {
  plannedStartAt: string | null
  plannedEndAt: string | null
}) {
  if (!shift.plannedStartAt || !shift.plannedEndAt) {
    return null
  }

  const minutes = Math.round(
    (Date.parse(shift.plannedEndAt) - Date.parse(shift.plannedStartAt)) / 60_000,
  )
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return [hours > 0 && `${hours} h`, rest > 0 && `${rest} min`].filter(Boolean).join(' ')
}

/**
 * The period a preparation's shifts cover while it is typed: from the earliest start to the latest
 * end among shifts whose period is valid, as instants, or `null` until one is.
 */
export function plannedCoverage(shifts: Array<{ plannedStartAt: string; plannedEndAt: string }>) {
  let start: number | null = null
  let end: number | null = null

  for (const shift of shifts) {
    const shiftStart = Date.parse(fromDateTimeLocalValue(shift.plannedStartAt) ?? '')
    const shiftEnd = Date.parse(fromDateTimeLocalValue(shift.plannedEndAt) ?? '')
    if (Number.isNaN(shiftStart) || Number.isNaN(shiftEnd) || shiftEnd <= shiftStart) {
      continue
    }

    start = start === null ? shiftStart : Math.min(start, shiftStart)
    end = end === null ? shiftEnd : Math.max(end, shiftEnd)
  }

  if (start === null || end === null) {
    return null
  }

  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

export function formatPeriod(period: Period, dischargeStatus: DischargeStatus) {
  if (isInEffect(period, dischargeStatus)) {
    return `Since ${formatDateTime(period.effectiveFrom)}`
  }

  // A closed discharge's period left open has ended without an end on record; saying so is
  // truer than presenting it as current or inventing a date.
  const end = period.effectiveTo === null ? 'end not recorded' : formatDateTime(period.effectiveTo)

  return `${formatDateTime(period.effectiveFrom)} – ${end}`
}

type LotOfCustomer = {
  customer: { id: string }
  expectedQuantityTonnes: string
  doorAssignments: unknown[]
}

/**
 * A discharge's lots under each of their customers, in the order the API lists them (customer, then
 * product), with the exact expected quantity of each customer.
 */
export function groupLotsByCustomer<Lot extends LotOfCustomer>(lots: Lot[]) {
  const groups = new Map<string, { customer: Lot['customer']; lots: Lot[] }>()

  for (const lot of lots) {
    const group = groups.get(lot.customer.id)
    if (group) {
      group.lots.push(lot)
    } else {
      groups.set(lot.customer.id, { customer: lot.customer, lots: [lot] })
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    subtotal: sumTonnes(group.lots.map((lot) => lot.expectedQuantityTonnes)) ?? '0.000',
  }))
}

export type LotRemovalBlock = 'E_DISCHARGE_LAST_PRODUCT_LOT' | 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS'

/**
 * Why a lot cannot be removed, known before asking, in the API's own refusal codes: a discharge
 * keeps at least one lot, and a lot that ever had a warehouse door keeps its history.
 */
export function lotRemovalBlock(lot: LotOfCustomer, lotCount: number): LotRemovalBlock | null {
  if (lotCount <= 1) {
    return 'E_DISCHARGE_LAST_PRODUCT_LOT'
  }

  return lot.doorAssignments.length > 0 ? 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS' : null
}
