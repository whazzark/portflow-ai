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
