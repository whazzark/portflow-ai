import type { DateTime } from 'luxon'

import type { PreparationIssue } from '#discharges/shared/discharge_preparation_issues'
import type {
  LockedTruck,
  TruckPoolRow,
} from '#discharges/shared/repositories/discharge_preparation_repository'

/**
 * The rules behind a discharge's truck pool and its shifts' truck selections. Every function here
 * is pure: it decides on rows the use case already read under the discharge's lock, and returns
 * the issues to refuse with or the rows to write. The database stays out of it, so every rule is
 * pinned at its edges without one.
 */

export const TRUCK_ISSUE_MESSAGES = {
  availableTruck: 'This truck is no longer available to reserve',
  heldTruck: "This truck is no longer in this discharge's pool",
  selectableTruck: 'A suspended truck cannot be newly selected',
} as const

export type TruckIssueRule = keyof typeof TRUCK_ISSUE_MESSAGES

/** A refused truck is reported at its position in the request, which is how the page finds it. */
export function truckIssue(index: number, rule: TruckIssueRule): PreparationIssue {
  return { field: `truckIds.${index}`, rule, message: TRUCK_ISSUE_MESSAGES[rule] }
}

/** A truck's reservation as it is written: the values captured from the truck at this moment. */
export type ReservationSnapshot = {
  truckId: string
  registrationSnapshot: string
  transportCompanyId: string | null
  transportCompanyNameSnapshot: string
  reservedAt: DateTime
}

export type ReservationPlan =
  | { kind: 'ISSUES'; issues: PreparationIssue[] }
  | {
      kind: 'PLAN'
      inserts: ReservationSnapshot[]
      reactivations: Array<ReservationSnapshot & { assignmentId: string }>
    }

/**
 * Decides a reservation of `requested` trucks for a planned discharge.
 *
 * - A truck that is unknown, archived, or suspended is refused, at its request position.
 * - A truck the discharge already holds is left as it is, so replaying a reservation plans
 *   nothing.
 * - A truck whose row for this discharge was released is held again on that same row, with its
 *   values captured again: one row per truck per discharge.
 *
 * Other discharges holding the truck are no input at all: planned discharges may compete for a
 * truck, and only the start confirmation makes it exclusive.
 */
export function planReservation(
  requested: readonly string[],
  pool: readonly TruckPoolRow[],
  trucks: ReadonlyMap<string, LockedTruck>,
  now: DateTime,
): ReservationPlan {
  const issues = requested.flatMap((truckId, index) =>
    trucks.get(truckId.toLowerCase())?.status === 'AVAILABLE'
      ? []
      : [truckIssue(index, 'availableTruck')],
  )
  if (issues.length > 0) {
    return { kind: 'ISSUES', issues }
  }

  const rows = new Map(pool.map((row) => [row.truckId.toLowerCase(), row]))
  const inserts: ReservationSnapshot[] = []
  const reactivations: Array<ReservationSnapshot & { assignmentId: string }> = []

  for (const truckId of requested) {
    const truck = trucks.get(truckId.toLowerCase()) as LockedTruck
    const row = rows.get(truckId.toLowerCase())
    const snapshot = {
      truckId: truck.id,
      registrationSnapshot: truck.registration,
      transportCompanyId: truck.transportCompanyId,
      transportCompanyNameSnapshot: truck.transportCompanyName,
      reservedAt: now,
    }

    if (!row) {
      inserts.push(snapshot)
    } else if (row.releasedAt !== null) {
      reactivations.push({ assignmentId: row.id, ...snapshot })
    }
  }

  return { kind: 'PLAN', inserts, reactivations }
}

export type ShiftSelectionPlan =
  | { kind: 'ISSUES'; issues: PreparationIssue[] }
  | {
      kind: 'PLAN'
      deleteIds: string[]
      inserts: Array<{ truckId: string; effectiveFrom: DateTime }>
    }

/**
 * Decides a planned shift's new truck selection from the complete one requested.
 *
 * - A truck the discharge does not hold is refused first, whatever its status: the page offered a
 *   pool that has changed since.
 * - A suspended truck may stay selected, but never become newly selected.
 * - Trucks in both selections keep their row; removed ones lose it, and added ones are selected
 *   from now. A shift that has not started has no period to end, so a removal deletes the row.
 */
export function planShiftSelection(
  requested: readonly string[],
  heldTruckIds: ReadonlySet<string>,
  currentSelection: ReadonlyArray<{ id: string; truckId: string }>,
  addedTrucks: ReadonlyMap<string, Pick<LockedTruck, 'status'>>,
  now: DateTime,
): ShiftSelectionPlan {
  const held = new Set([...heldTruckIds].map((id) => id.toLowerCase()))
  const selected = new Set(currentSelection.map((row) => row.truckId.toLowerCase()))
  const wanted = requested.map((id) => id.toLowerCase())

  const issues = wanted.flatMap((truckId, index) => {
    if (!held.has(truckId)) {
      return [truckIssue(index, 'heldTruck')]
    }
    if (!selected.has(truckId) && addedTrucks.get(truckId)?.status !== 'AVAILABLE') {
      return [truckIssue(index, 'selectableTruck')]
    }

    return []
  })
  if (issues.length > 0) {
    return { kind: 'ISSUES', issues }
  }

  const wantedSet = new Set(wanted)

  return {
    kind: 'PLAN',
    deleteIds: currentSelection
      .filter((row) => !wantedSet.has(row.truckId.toLowerCase()))
      .map((row) => row.id),
    inserts: wanted
      .filter((truckId) => !selected.has(truckId))
      .map((truckId) => ({ truckId, effectiveFrom: now })),
  }
}

/**
 * Decides a withdrawal from a planned discharge's pool: the reservations of the requested trucks
 * the discharge holds, and their current selections in its planned shifts. Before the discharge
 * starts nothing has happened operationally, so both are deleted rather than released or ended.
 * A truck the discharge does not hold — already withdrawn, or only released — is ignored, which is
 * what makes a repeated withdrawal harmless.
 */
export function planWithdrawal(
  requested: readonly string[],
  pool: readonly TruckPoolRow[],
  currentSelections: ReadonlyArray<{ id: string; truckId: string }>,
) {
  const wanted = new Set(requested.map((id) => id.toLowerCase()))
  const held = pool.filter(
    (row) => row.releasedAt === null && wanted.has(row.truckId.toLowerCase()),
  )
  const heldIds = new Set(held.map((row) => row.truckId.toLowerCase()))

  return {
    assignmentIds: held.map((row) => row.id),
    selectionIds: currentSelections
      .filter((row) => heldIds.has(row.truckId.toLowerCase()))
      .map((row) => row.id),
  }
}
