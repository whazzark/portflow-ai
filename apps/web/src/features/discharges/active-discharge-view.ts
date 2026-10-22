import {
  dischargePeriod,
  isInEffect,
  shiftResources,
} from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'

type Shift = DischargeDetailDto['shifts'][number]

export type NextShift = {
  shift: Shift
  counts: { trucks: number; warehouseDoors: number; weighingAreas: number }
}

export type ActiveShiftSummary =
  | {
      state: 'ACTIVE'
      shift: Shift
      /** Its rank among the discharge's shifts, in planned order, counted from one. */
      position: { index: number; total: number }
      resources: ReturnType<typeof shiftResources>
      next: NextShift | null
    }
  | { state: 'BETWEEN'; last: Shift | null; next: NextShift | null }

function nextShift(shifts: Shift[], after: number): NextShift | null {
  const shift = shifts.slice(after + 1).find((candidate) => candidate.status === 'PLANNED')
  if (!shift) {
    return null
  }
  const resources = shiftResources(shift)

  return {
    shift,
    counts: {
      trucks: resources.truckIds.length,
      warehouseDoors: resources.warehouseDoors.length,
      weighingAreas: resources.weighingAreas.length,
    },
  }
}

/**
 * What a started discharge is doing now: its active shift and the one after it, or, between two
 * shifts, the last one worked and the next one planned. Shifts come in planned order.
 */
export function activeShiftSummary(
  discharge: Pick<DischargeDetailDto, 'shifts'>,
): ActiveShiftSummary {
  const { shifts } = discharge
  const activeIndex = shifts.findIndex((shift) => shift.status === 'ACTIVE')

  if (activeIndex >= 0) {
    const shift = shifts[activeIndex]

    return {
      state: 'ACTIVE',
      shift,
      position: { index: activeIndex + 1, total: shifts.length },
      resources: shiftResources(shift),
      next: nextShift(shifts, activeIndex),
    }
  }

  const lastIndex = shifts.findLastIndex((shift) => shift.status === 'COMPLETED')

  return {
    state: 'BETWEEN',
    last: lastIndex >= 0 ? shifts[lastIndex] : null,
    next: nextShift(shifts, lastIndex),
  }
}

/**
 * Where a started discharge stands, from what its record already holds: its shifts by state, its
 * product lots and the doors they hold now, and the trucks it holds or has released.
 */
export function dischargeProgress(
  discharge: Pick<
    DischargeDetailDto,
    'status' | 'expectedTonnage' | 'productLots' | 'truckPool' | 'shifts'
  >,
) {
  const { shifts, productLots, truckPool } = discharge
  const count = (status: Shift['status']) =>
    shifts.filter((shift) => shift.status === status).length

  const doorNames: string[] = []
  let withDoor = 0
  for (const lot of productLots) {
    const held = lot.doorAssignments.filter((period) => isInEffect(period, discharge.status))
    if (held.length > 0) {
      withDoor += 1
    }
    for (const period of held) {
      if (!doorNames.includes(period.warehouseDoor.name)) {
        doorNames.push(period.warehouseDoor.name)
      }
    }
  }

  return {
    shifts: {
      total: shifts.length,
      completed: count('COMPLETED'),
      active: count('ACTIVE'),
      planned: count('PLANNED'),
      plannedEnd: dischargePeriod(discharge).to,
    },
    lots: {
      total: productLots.length,
      customers: new Set(productLots.map((lot) => lot.customer.id)).size,
      expectedTonnage: discharge.expectedTonnage,
      withDoor: { count: withDoor, doorNames },
      withoutDoor: productLots.length - withDoor,
    },
    trucks: {
      held: truckPool.filter((entry) => entry.releasedAt === null).length,
      released: truckPool
        .filter((entry) => entry.releasedAt !== null)
        .map((entry) => ({ registration: entry.registration, releasedAt: entry.releasedAt })),
    },
  }
}
