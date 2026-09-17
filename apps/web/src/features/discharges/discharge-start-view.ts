import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { lotLabel } from '@/features/discharges/discharge-planning-view'
import { heldPoolEntries } from '@/features/discharges/truck-pool-selection'
import type {
  DischargeDetailDto,
  DischargeDetailTab,
  StartProblemDto,
} from '@/features/discharges/types'

type Lot = DischargeDetailDto['productLots'][number]
type Customer = Lot['customer']

export type ReviewDoor = { id: string; door: string; warehouse: string }

export type StartReview = {
  customers: Array<{
    customer: Customer
    lots: Array<{ id: string; productName: string; doors: ReviewDoor[] }>
  }>
  heldTrucks: number
  shift: null | {
    id: string
    label: string
    responsible: string
    trucks: Array<{ id: string; registration: string; suspended: boolean }>
    doors: ReviewDoor[]
    weighingAreas: Array<{ id: string; name: string }>
  }
}

const current = <Row extends { effectiveTo: string | null }>(rows: Row[]) =>
  rows.filter((row) => row.effectiveTo === null)

const reviewDoor = (row: {
  warehouseDoor: { id: string; name: string }
  warehouse: { name: string }
}): ReviewDoor => ({
  id: row.warehouseDoor.id,
  door: row.warehouseDoor.name,
  warehouse: row.warehouse.name,
})

/**
 * What the start confirmation shows before anything changes: the customers and their lots with the
 * doors each lot currently has, how many trucks the discharge holds, and the shift that would start
 * with the resources it currently uses. The shift is the one the start check names, since the server
 * is the one that chooses it.
 */
export function startReview(detail: DischargeDetailDto, shiftId: string | null): StartReview {
  const customers = new Map<string, StartReview['customers'][number]>()

  for (const lot of detail.productLots) {
    const group = customers.get(lot.customer.id) ?? { customer: lot.customer, lots: [] }
    group.lots.push({
      id: lot.id,
      productName: lot.productName,
      doors: current(lot.doorAssignments).map(reviewDoor),
    })
    customers.set(lot.customer.id, group)
  }

  const shift = shiftId ? detail.shifts.find((candidate) => candidate.id === shiftId) : undefined

  return {
    customers: [...customers.values()],
    heldTrucks: heldPoolEntries(detail).length,
    shift: shift
      ? {
          id: shift.id,
          label: formatShiftPeriod(shift),
          responsible: `${shift.responsible.firstName} ${shift.responsible.lastName}`,
          trucks: current(shift.trucks).map((truck) => ({
            id: truck.truckId,
            registration: truck.registration,
            suspended: truck.truckStatus === 'SUSPENDED',
          })),
          doors: current(shift.warehouseDoors).map(reviewDoor),
          weighingAreas: current(shift.weighingAreas).map((area) => ({
            id: area.weighingArea.id,
            name: area.weighingArea.name,
          })),
        }
      : null,
  }
}

type Problem = StartProblemDto

/** Where the user fixes a problem: a section of this discharge, or the discharge holding a resource. */
export type StartProblemLink =
  | { kind: 'section'; tab: DischargeDetailTab; shiftId?: string }
  | { kind: 'discharge'; dischargeId: string; tab: DischargeDetailTab }

/** One thing wrong, with the other active discharge holding the resource when that is why. */
export type StartProblemLine = {
  text: string
  holder?: { vesselName: string; link: StartProblemLink }
  /** What the line counts, such as the registrations of the trucks it holds. */
  detail?: string
}

/** The problems of one lot, one shift, or one holder's trucks, under that subject's name if known. */
export type StartProblemItem = {
  key: string
  heading?: { text: string; link?: StartProblemLink }
  lines: StartProblemLine[]
}

type SectionKey = 'dock' | 'product-lots' | 'truck-pool' | 'shifts'

/** The problems of one kind of element, fixed in the detail's section of the same name. */
export type StartProblemSection = {
  key: SectionKey
  title: string
  link: StartProblemLink
  items: StartProblemItem[]
}

function doorLabel(detail: DischargeDetailDto, doorId: string) {
  const rows = [
    ...detail.productLots.flatMap((lot) => lot.doorAssignments),
    ...detail.shifts.flatMap((shift) => shift.warehouseDoors),
  ]
  const row = rows.find((candidate) => candidate.warehouseDoor.id === doorId)

  return row ? `${row.warehouseDoor.name} · ${row.warehouse.name}` : null
}

function lotOf(detail: DischargeDetailDto, lotId: string | undefined) {
  return detail.productLots.find((lot) => lot.id === lotId)
}

const SECTIONS: Record<SectionKey, { title: string; tab: DischargeDetailTab }> = {
  dock: { title: 'Dock', tab: 'overview' },
  'product-lots': { title: 'Product lots', tab: 'product-lots' },
  'truck-pool': { title: 'Truck pool', tab: 'truck-pool' },
  shifts: { title: 'Shifts', tab: 'shifts' },
}

/**
 * The problems of a start by kind of element, in the detail's section order: the dock, the lots with
 * their doors, the truck pool, the shifts. A conflict is fixed in this discharge too — change the
 * dock, reassign the door, withdraw the truck — so it sits with its element, naming the discharge
 * holding it as a secondary link. Within a section, each lot and each shift gathers its own
 * problems, and a holder's trucks read as one line. Labels come from the detail on screen; a subject
 * it no longer knows keeps a general wording, without a heading.
 */
export function startProblemSections(
  problems: Problem[],
  detail: DischargeDetailDto,
): StartProblemSection[] {
  const items = new Map<SectionKey, Map<string, StartProblemItem>>()
  const heldTrucks = new Map<
    string,
    { holder: StartProblemLine['holder']; trucks: Array<string | null> }
  >()
  const shifts = [...detail.shifts].sort((left, right) =>
    (left.plannedStartAt ?? '').localeCompare(right.plannedStartAt ?? ''),
  )

  const add = (
    section: SectionKey,
    key: string,
    heading: StartProblemItem['heading'],
    line: StartProblemLine,
  ) => {
    const inSection = items.get(section) ?? new Map<string, StartProblemItem>()
    const item = inSection.get(key) ?? { key, ...(heading ? { heading } : {}), lines: [] }
    item.lines.push(line)
    inSection.set(key, item)
    items.set(section, inSection)
  }
  // Problems without a known subject share one item without a heading.
  const general = (section: SectionKey, line: StartProblemLine) =>
    add(section, 'general', undefined, line)
  const inLot = (lotId: string | undefined, line: StartProblemLine, fallback: string) => {
    const lot = lotOf(detail, lotId)

    if (lot) {
      add('product-lots', `lot:${lot.id}`, { text: lotLabel(lot) }, line)
    } else {
      // The line keeps its holder: only the lot's name is unknown.
      general('product-lots', { ...line, text: fallback })
    }
  }
  const inShift = (shiftId: string | undefined, text: string, fallback: string) => {
    const shift = shifts.find((candidate) => candidate.id === shiftId)

    if (shift) {
      add(
        'shifts',
        `shift:${shift.id}`,
        {
          text: `Shift ${formatShiftPeriod(shift)}`,
          link: { kind: 'section', tab: 'shifts', shiftId: shift.id },
        },
        { text },
      )
    } else {
      general('shifts', { text: fallback })
    }
  }
  const holderOf = (problem: Problem, tab: DischargeDetailTab): StartProblemLine['holder'] => ({
    vesselName: problem.holder?.vesselName ?? 'another active discharge',
    link: { kind: 'discharge', dischargeId: problem.holder?.dischargeId ?? detail.id, tab },
  })

  for (const problem of problems) {
    const { subject, context } = problem

    switch (problem.code) {
      case 'DOCK_ARCHIVED':
        add('dock', 'dock', undefined, { text: `${detail.dock.name} is archived` })
        break
      case 'DOCK_HELD':
        add('dock', 'dock', undefined, {
          text: `${detail.dock.name} serves`,
          holder: holderOf(problem, 'overview'),
        })
        break
      case 'NO_PRODUCT_LOT':
        general('product-lots', { text: 'No product lot' })
        break
      case 'LOT_WITHOUT_WAREHOUSE_DOOR':
        inLot(
          subject.id,
          { text: 'No warehouse door assigned' },
          'A product lot has no warehouse door assigned',
        )
        break
      case 'CUSTOMER_ARCHIVED': {
        const customer = detail.productLots.find((lot) => lot.customer.id === subject.id)?.customer
        const text = customer ? `Customer ${customer.name} is archived` : 'A customer is archived'
        inLot(context?.id, { text }, text)
        break
      }
      case 'WAREHOUSE_DOOR_ARCHIVED': {
        const door = doorLabel(detail, subject.id)
        const text = door ? `Door ${door} is archived` : 'A warehouse door is archived'

        if (context?.type === 'SHIFT') {
          inShift(context.id, text, 'A warehouse door of a shift is archived')
        } else {
          inLot(context?.id, { text }, text)
        }
        break
      }
      case 'WAREHOUSE_DOOR_HELD': {
        const door = doorLabel(detail, subject.id)
        const holder = holderOf(problem, 'product-lots')
        const text = door ? `Door ${door} held by` : 'A warehouse door held by'
        inLot(context?.id, { text, holder }, 'A warehouse door of a lot is held by')
        break
      }
      case 'TRUCK_HELD': {
        const key = problem.holder?.dischargeId ?? ''
        const held = heldTrucks.get(key) ?? { holder: holderOf(problem, 'truck-pool'), trucks: [] }
        held.trucks.push(
          detail.truckPool.find((entry) => entry.truckId === subject.id)?.registration ?? null,
        )
        heldTrucks.set(key, held)
        break
      }
      case 'NO_PLANNED_SHIFT':
        general('shifts', { text: 'No planned shift' })
        break
      case 'SHIFT_WITHOUT_TRUCK':
        inShift(subject.id, 'No usable truck', 'A shift has no usable truck')
        break
      case 'SHIFT_WITHOUT_WAREHOUSE_DOOR':
        inShift(subject.id, 'No usable warehouse door', 'A shift has no usable warehouse door')
        break
      case 'SHIFT_WITHOUT_WEIGHING_AREA':
        inShift(subject.id, 'No usable weighing area', 'A shift has no usable weighing area')
        break
      case 'WEIGHING_AREA_ARCHIVED': {
        const area = detail.shifts
          .flatMap((shift) => shift.weighingAreas)
          .find((row) => row.weighingArea.id === subject.id)?.weighingArea
        inShift(
          context?.id,
          area ? `Weighing area ${area.name} is archived` : 'A weighing area is archived',
          'A weighing area of a shift is archived',
        )
        break
      }
      case 'TRUCK_ARCHIVED': {
        const registration = [
          ...detail.truckPool,
          ...detail.shifts.flatMap((shift) => shift.trucks),
        ].find((row) => row.truckId === subject.id)?.registration
        inShift(
          context?.id,
          registration ? `Truck ${registration} is archived` : 'A truck is archived',
          'A truck of a shift is archived',
        )
        break
      }
      case 'RESPONSIBLE_INELIGIBLE': {
        const responsible = detail.shifts.find((shift) => shift.id === context?.id)?.responsible
        inShift(
          context?.id,
          responsible
            ? `${responsible.firstName} ${responsible.lastName} can no longer be responsible`
            : 'The responsible can no longer be responsible',
          'The responsible of a shift can no longer be responsible',
        )
        break
      }
    }
  }

  for (const [key, { holder, trucks }] of heldTrucks) {
    const registrations = trucks.filter((registration) => registration !== null)
    const text =
      trucks.length > 1
        ? `${trucks.length} trucks held by`
        : registrations[0]
          ? `Truck ${registrations[0]} held by`
          : 'A truck of the pool held by'
    add('truck-pool', `holder:${key}`, undefined, {
      text,
      holder,
      ...(trucks.length > 1 && registrations.length > 0
        ? { detail: registrations.join(', ') }
        : {}),
    })
  }

  // Lots in the detail's order and shifts in calendar order, general problems first.
  const rank = (key: string) => {
    const lot = detail.productLots.findIndex((candidate) => `lot:${candidate.id}` === key)
    const shift = shifts.findIndex((candidate) => `shift:${candidate.id}` === key)

    return key === 'general' ? -1 : Math.max(lot, shift)
  }

  return (Object.keys(SECTIONS) as SectionKey[]).flatMap((key) => {
    const inSection = items.get(key)
    if (!inSection) {
      return []
    }

    const { title, tab } = SECTIONS[key]
    const ordered = [...inSection.values()]
    if (key !== 'truck-pool') {
      ordered.sort((left, right) => rank(left.key) - rank(right.key))
    }

    return [{ key, title, link: { kind: 'section', tab } as const, items: ordered }]
  })
}
