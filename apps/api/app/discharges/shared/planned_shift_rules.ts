import type { DateTime } from 'luxon'

import {
  type PreparationIssue,
  unassignedWarehouseDoorIssue,
} from '#discharges/shared/discharge_preparation_issues'
import {
  isOrderedPeriod,
  orderShifts,
  periodsOverlap,
  shiftOverlapIssue,
  shiftPeriodOrderIssue,
} from '#discharges/shared/discharge_preparation_rules'
import type {
  LockedWarehouseDoor,
  LockedWeighingArea,
  ShiftResourceSelectionRow,
} from '#discharges/shared/repositories/discharge_preparation_repository'
import type { ShiftStatus } from '#models/shift'

/**
 * The rules behind correcting one planned shift: its period among its discharge's other shifts,
 * the sequence every shift then holds, and its warehouse door and weighing area selections. Like
 * the truck pool rules, every function here is pure: it decides on rows the use case already read
 * under the discharge's lock.
 */

type PlannedPeriod = { plannedStartAt: DateTime; plannedEndAt: DateTime }

/**
 * The rules a corrected period breaks, reported at the field the form holds it in. The period is
 * compared with every other shift of its discharge, whatever their status: a started shift still
 * occupies its planned time.
 */
export function findShiftPeriodIssues(
  period: PlannedPeriod,
  otherShifts: readonly PlannedPeriod[],
) {
  const issues: PreparationIssue[] = []

  if (!isOrderedPeriod(period)) {
    issues.push(shiftPeriodOrderIssue('plannedEndAt'))
  }
  if (otherShifts.some((other) => periodsOverlap(period, other))) {
    issues.push(shiftOverlapIssue('plannedStartAt'))
  }

  return issues
}

/**
 * The sequences that change once one shift's period is corrected. Shifts stay numbered in the
 * order they are planned to start, so a period moved past another shift swaps their numbers; the
 * shifts whose number stays are left out. `shifts` is every shift of the discharge in its current
 * sequence order, which is what keeps equal starts in the order they already had.
 */
export function planShiftSequences(
  shifts: ReadonlyArray<PlannedPeriod & { id: string; sequence: number }>,
  corrected: PlannedPeriod & { id: string },
) {
  const periods = [...shifts]
    .sort((left, right) => left.sequence - right.sequence)
    .map((shift) =>
      shift.id === corrected.id
        ? {
            ...shift,
            plannedStartAt: corrected.plannedStartAt,
            plannedEndAt: corrected.plannedEndAt,
          }
        : shift,
    )
  const current = new Map(shifts.map((shift) => [shift.id, shift.sequence]))

  return orderShifts(periods)
    .filter((shift) => current.get(shift.id) !== shift.sequence)
    .map((shift) => ({ shiftId: shift.id, sequence: shift.sequence }))
}

type ExistingShift = PlannedPeriod & { id: string; sequence: number; status: ShiftStatus }

/**
 * When a started shift started. No slice records an actual start yet, so its planned start stands
 * in for it. GH-65, which records the actual start, must return it here once one exists: a shift
 * started early would otherwise let a new shift be planned before it.
 */
export function startedShiftStart(shift: PlannedPeriod & { status: ShiftStatus }) {
  return shift.plannedStartAt
}

export function shiftAfterStartedShiftsIssue(field: string): PreparationIssue {
  return {
    field,
    rule: 'shiftAfterStartedShifts',
    message: 'A new shift must start after the shifts already started',
  }
}

/**
 * The rules a shift added to a discharge breaks, at the fields the form holds them in. Its period is
 * judged as a corrected one is, against every shift whatever its status. Planned shifts also start
 * in chronological order, so on a discharge already under way a new shift must start after every
 * shift that has started; between planned shifts, it may go anywhere they leave room.
 */
export function findAddedShiftIssues(period: PlannedPeriod, shifts: readonly ExistingShift[]) {
  const issues = findShiftPeriodIssues(period, shifts)
  const startedStarts = shifts
    .filter((shift) => shift.status !== 'PLANNED')
    .map((shift) => startedShiftStart(shift).toMillis())

  if (startedStarts.length > 0 && period.plannedStartAt.toMillis() <= Math.max(...startedStarts)) {
    issues.push(shiftAfterStartedShiftsIssue('plannedStartAt'))
  }

  return issues
}

/**
 * The sequence a new shift takes among its discharge's shifts, and the sequences of the existing
 * shifts that move to make room for it. `shifts` is every shift in its current sequence order, which
 * keeps equal starts in the order they already had; the new shift goes after them.
 *
 * A started shift is history and keeps its number. The started-shift rule places a new shift after
 * every one of them, so a plan that would move one is a broken invariant, not a refusal. That holds
 * only while shifts start in planned-start order: GH-65, if it lets a later shift start before an
 * earlier planned one, must turn this into a refusal or renumber around started shifts.
 */
export function planAddedShiftSequences(shifts: readonly ExistingShift[], added: PlannedPeriod) {
  const ordered = orderShifts<PlannedPeriod & { id: string | null }>([
    ...[...shifts].sort((left, right) => left.sequence - right.sequence),
    { ...added, id: null },
  ])
  const current = new Map(shifts.map((shift) => [shift.id, shift]))
  const sequences: Array<{ shiftId: string; sequence: number }> = []
  let sequence = 0

  for (const shift of ordered) {
    if (shift.id === null) {
      sequence = shift.sequence
      continue
    }
    const existing = current.get(shift.id)
    if (existing && existing.sequence !== shift.sequence) {
      if (existing.status !== 'PLANNED') {
        throw new Error(`Adding a shift would renumber started shift ${existing.id}`)
      }
      sequences.push({ shiftId: existing.id, sequence: shift.sequence })
    }
  }

  return { sequence, sequences }
}

export const SHIFT_RESOURCE_ISSUE_MESSAGES = {
  availableWarehouseDoor: 'This warehouse door is no longer available',
  availableWeighingArea: 'This weighing area is no longer available',
} as const

export type ShiftResourceSelectionPlan =
  | { kind: 'ISSUES'; issues: PreparationIssue[] }
  | {
      kind: 'PLAN'
      deleteIds: string[]
      inserts: Array<{ resourceId: string; effectiveFrom: DateTime }>
    }

/**
 * Decides a planned shift's new resource selection from the complete one requested, as
 * `planShiftSelection` does for its trucks.
 *
 * - A resource that is not selected yet must be selectable now, or it is refused at its request
 *   position.
 * - A resource already selected may stay, even if it was archived since: the selection was valid
 *   when it was made, and taking it away is the planner's decision.
 * - Resources in both selections keep their row; removed ones lose it, and added ones are selected
 *   from now. A shift that has not started has no period to end, so a removal deletes the row.
 */
function planShiftResourceSelection(
  requested: readonly string[],
  currentSelection: readonly ShiftResourceSelectionRow[],
  isSelectable: (resourceId: string) => boolean,
  issue: (index: number, resourceId: string) => PreparationIssue,
  now: DateTime,
): ShiftResourceSelectionPlan {
  const selected = new Set(currentSelection.map((row) => row.resourceId.toLowerCase()))
  const wanted = requested.map((id) => id.toLowerCase())

  const issues = wanted.flatMap((resourceId, index) =>
    selected.has(resourceId) || isSelectable(resourceId) ? [] : [issue(index, resourceId)],
  )
  if (issues.length > 0) {
    return { kind: 'ISSUES', issues }
  }

  const wantedSet = new Set(wanted)

  return {
    kind: 'PLAN',
    deleteIds: currentSelection
      .filter((row) => !wantedSet.has(row.resourceId.toLowerCase()))
      .map((row) => row.id),
    inserts: wanted
      .filter((resourceId) => !selected.has(resourceId))
      .map((resourceId) => ({ resourceId, effectiveFrom: now })),
  }
}

/**
 * A door is newly selectable only while both it and its warehouse are available — the doors of an
 * archived warehouse are offered nowhere, as the available door listing already decides — and only
 * while a product lot of this discharge currently holds it: a shift unloads into the doors its
 * cargo was assigned to, so a door no lot holds is refused rather than silently selected.
 *
 * A door already selected keeps its row either way, so withdrawing an assignment never invalidates
 * a selection made while it stood.
 */
export function planShiftWarehouseDoorSelection(
  requested: readonly string[],
  currentSelection: readonly ShiftResourceSelectionRow[],
  addedDoors: ReadonlyMap<string, Pick<LockedWarehouseDoor, 'status' | 'warehouseStatus'>>,
  assignedDoorIds: readonly string[],
  now: DateTime,
) {
  const assigned = new Set(assignedDoorIds.map((id) => id.toLowerCase()))
  const isAvailable = (doorId: string) => {
    const door = addedDoors.get(doorId)

    return door?.status === 'AVAILABLE' && door.warehouseStatus === 'AVAILABLE'
  }

  return planShiftResourceSelection(
    requested,
    currentSelection,
    (doorId) => isAvailable(doorId) && assigned.has(doorId),
    // An available door no lot holds is a different refusal from an archived one, and the form
    // shows the reason at the door the user checked.
    (index, doorId) =>
      isAvailable(doorId)
        ? unassignedWarehouseDoorIssue(`warehouseDoorIds.${index}`)
        : {
            field: `warehouseDoorIds.${index}`,
            rule: 'availableWarehouseDoor',
            message: SHIFT_RESOURCE_ISSUE_MESSAGES.availableWarehouseDoor,
          },
    now,
  )
}

export function planShiftWeighingAreaSelection(
  requested: readonly string[],
  currentSelection: readonly ShiftResourceSelectionRow[],
  addedAreas: ReadonlyMap<string, Pick<LockedWeighingArea, 'status'>>,
  now: DateTime,
) {
  return planShiftResourceSelection(
    requested,
    currentSelection,
    (areaId) => addedAreas.get(areaId)?.status === 'AVAILABLE',
    (index) => ({
      field: `weighingAreaIds.${index}`,
      rule: 'availableWeighingArea',
      message: SHIFT_RESOURCE_ISSUE_MESSAGES.availableWeighingArea,
    }),
    now,
  )
}
