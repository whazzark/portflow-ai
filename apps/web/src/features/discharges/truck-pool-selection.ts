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

export type PoolSummary = {
  heldCount: number
  suspendedCount: number
  /** Another discharge also holds one of the held trucks. */
  contested: boolean
  /** One of those other discharges is active, so starting first settles nothing. */
  contestedByActive: boolean
}

/** What the pool holds at a glance; released history counts for nothing. */
export function poolSummary(detail: DischargeDetailDto): PoolSummary {
  const held = heldPoolEntries(detail)
  const holdings = held.flatMap((entry) => entry.otherHoldings)

  return {
    heldCount: held.length,
    suspendedCount: held.filter((entry) => entry.truckStatus === 'SUSPENDED').length,
    contested: holdings.length > 0,
    contestedByActive: holdings.some((holding) => holding.status === 'ACTIVE'),
  }
}

/**
 * How many planned shifts currently select each truck: the same shifts a withdrawal would change,
 * so the count and the withdrawal's confirmation never disagree.
 */
export function shiftCountByTruck(detail: DischargeDetailDto) {
  const counts = new Map<string, number>()

  for (const shift of detail.shifts.filter((candidate) => candidate.status === 'PLANNED')) {
    for (const truckId of currentTruckIds(shift)) {
      counts.set(truckId, (counts.get(truckId) ?? 0) + 1)
    }
  }

  return counts
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

export type CandidateGroup = {
  company: TruckCandidateDto['transportCompany']
  candidates: TruckCandidateDto[]
  total: number
  selected: number
}

/** The candidates by transport company, both in name order, each with how many are selected. */
export function candidateGroups(
  candidates: readonly TruckCandidateDto[],
  selectedIds: ReadonlySet<string>,
): CandidateGroup[] {
  const groups = new Map<string, CandidateGroup>()

  for (const candidate of candidates) {
    const group = groups.get(candidate.transportCompany.id) ?? {
      company: candidate.transportCompany,
      candidates: [],
      total: 0,
      selected: 0,
    }
    group.candidates.push(candidate)
    group.total += 1
    group.selected += selectedIds.has(candidate.id) ? 1 : 0
    groups.set(candidate.transportCompany.id, group)
  }

  const byName = (left: string, right: string) => left.localeCompare(right)

  return [...groups.values()]
    .map((group) => ({
      ...group,
      candidates: group.candidates.sort((left, right) =>
        byName(left.registration, right.registration),
      ),
    }))
    .sort((left, right) => byName(left.company.name, right.company.name))
}
