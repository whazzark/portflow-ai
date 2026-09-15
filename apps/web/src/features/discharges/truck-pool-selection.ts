import type { DischargeDetailDto, TruckCandidateDto } from '@/features/discharges/types'
import { normalizeSearch } from '@/helpers/search'

type PoolEntry = DischargeDetailDto['truckPool'][number]
type Shift = DischargeDetailDto['shifts'][number]

/** The trucks a discharge still holds, in pool order. A closed discharge holds none. */
export function heldPoolEntries(detail: DischargeDetailDto): PoolEntry[] {
  if (detail.status === 'CLOSED') {
    return []
  }

  return detail.truckPool.filter((entry) => entry.releasedAt === null)
}

/** A shift's trucks still in effect; an ended membership is history, not a selection. */
export function currentTruckIds(shift: Shift) {
  return new Set(
    shift.trucks.filter((truck) => truck.effectiveTo === null).map((truck) => truck.truckId),
  )
}

/** The gap the preparation summary counts: a planned shift nobody has given a truck yet. */
export function missingTrucks(shift: Shift) {
  return shift.status === 'PLANNED' && currentTruckIds(shift).size === 0
}

/**
 * The planned shifts that currently select one of these trucks, in chronological order: the shifts
 * a withdrawal of those trucks also changes.
 */
export function shiftsSelectingTrucks(detail: DischargeDetailDto, truckIds: readonly string[]) {
  return detail.shifts
    .filter((shift) => shift.status === 'PLANNED')
    .filter((shift) => {
      const selected = currentTruckIds(shift)

      return truckIds.some((truckId) => selected.has(truckId))
    })
    .sort((left, right) => (left.plannedStartAt ?? '').localeCompare(right.plannedStartAt ?? ''))
}

export type OfferedShiftTruck = {
  truckId: string
  registration: string
  truckStatus: PoolEntry['truckStatus']
  selected: boolean
  /** A suspended truck can stay selected, but never become newly selected. */
  canCheck: boolean
}

/**
 * The trucks a planned shift may use: every held truck in service, and the suspended ones the shift
 * already selected, which it may keep or let go of.
 */
export function offeredShiftTrucks(
  detail: DischargeDetailDto,
  shiftId: string,
): OfferedShiftTruck[] {
  const shift = detail.shifts.find((candidate) => candidate.id === shiftId)
  const selected = shift ? currentTruckIds(shift) : new Set<string>()

  return heldPoolEntries(detail)
    .filter((entry) => entry.truckStatus !== 'SUSPENDED' || selected.has(entry.truckId))
    .map((entry) => ({
      truckId: entry.truckId,
      registration: entry.registration,
      truckStatus: entry.truckStatus,
      selected: selected.has(entry.truckId),
      canCheck: entry.truckStatus !== 'SUSPENDED',
    }))
}

/** Normalized like the trucks list's search, on the fields a candidate row shows. */
export function candidateMatchesSearch(candidate: TruckCandidateDto, search: string) {
  const normalizedSearch = normalizeSearch(search)

  return (
    !normalizedSearch ||
    normalizeSearch(candidate.registration).includes(normalizedSearch) ||
    normalizeSearch(candidate.transportCompany.name).includes(normalizedSearch)
  )
}
