import type { DateTime } from 'luxon'

import {
  doorSelectedByPlannedShiftIssue,
  type PreparationIssue,
  unassignedWarehouseDoorIssue,
  unavailableWarehouseDoorIssue,
  unavailableWeighingAreaIssue,
} from '#discharges/shared/discharge_preparation_issues'

/**
 * The one time a planning command records: every row it starts begins at it, and every row it ends
 * stops at it, so a door moved between two lots leaves no gap and no overlap.
 *
 * It is the server time truncated to the second, because SQLite stores date-times without
 * milliseconds and a finer instant would not survive the round trip. When something in the
 * command's scope was already recorded in that second or later, as two quick saves or a skewed
 * clock produce, the instant moves one second past it. That keeps every period strictly positive,
 * as the tables' checks require, and keeps a door withdrawn and assigned again from starting twice
 * at the same time.
 */
export function recordedInstant(now: DateTime, latestRecorded: DateTime | null) {
  const instant = now.toUTC().startOf('second')

  if (latestRecorded && latestRecorded.toMillis() >= instant.toMillis()) {
    return latestRecorded.toUTC().startOf('second').plus({ seconds: 1 })
  }

  return instant
}

const lower = (id: string) => id.toLowerCase()

/**
 * An identity may not be both added and ended by one change: the save would mean two things at
 * once. Each clash is reported at its position in the second list.
 */
export function listOverlapIssues({
  first,
  second,
  field,
}: {
  first: string[]
  second: string[]
  field: string
}): PreparationIssue[] {
  const added = new Set(first.map(lower))

  return second.flatMap((id, index) =>
    added.has(lower(id))
      ? [
          {
            field: `${field}.${index}`,
            // biome-ignore lint/security/noSecrets: rule name, not a secret
            rule: 'notInBothLists',
            message: 'This identity is also listed to be added',
          },
        ]
      : [],
  )
}

export type LotDoorPlan = {
  /** Current assignment rows to end. */
  end: string[]
  /** Doors to start on the lot. */
  start: string[]
  /** Doors taken from another lot of the discharge, and that lot. */
  moves: Array<{ doorId: string; fromLotId: string }>
  issues: PreparationIssue[]
}

type ResourceStatus = 'AVAILABLE' | 'ARCHIVED'

/**
 * Applies a lot's door change set to the discharge's current assignments. A door already on the
 * lot is left as it is, a door the lot does not hold is not withdrawn, and a door another lot holds
 * moves: its row ends as this lot's starts, so a door is never current on two lots at once.
 *
 * A door is refused when it, or its warehouse, is no longer available, as read under lock. A door
 * of the lot is refused withdrawal while a planned shift selects it, since that shift could no
 * longer send a rotation to it; moving it to another lot keeps it assigned, and is accepted.
 */
export function planLotDoorChanges({
  lotId,
  assign,
  withdraw,
  currentAssignments,
  doorsById,
  plannedShiftDoorIds,
}: {
  lotId: string
  assign: string[]
  withdraw: string[]
  currentAssignments: Array<{ id: string; productLotId: string; warehouseDoorId: string }>
  doorsById: Map<string, { status: ResourceStatus; warehouseStatus: ResourceStatus }>
  plannedShiftDoorIds: string[]
}): LotDoorPlan {
  const plan: LotDoorPlan = { end: [], start: [], moves: [], issues: [] }
  const holders = new Map(
    currentAssignments.map((assignment) => [lower(assignment.warehouseDoorId), assignment]),
  )
  const lot = lower(lotId)
  const selectedByShifts = new Set(plannedShiftDoorIds.map(lower))

  assign.forEach((id, index) => {
    const door = doorsById.get(lower(id))

    if (door?.status !== 'AVAILABLE' || door.warehouseStatus !== 'AVAILABLE') {
      plan.issues.push(unavailableWarehouseDoorIssue(`assign.${index}`))
    }
  })
  withdraw.forEach((id, index) => {
    const holder = holders.get(lower(id))

    if (holder && lower(holder.productLotId) === lot && selectedByShifts.has(lower(id))) {
      plan.issues.push(doorSelectedByPlannedShiftIssue(`withdraw.${index}`))
    }
  })

  for (const doorId of new Set(assign.map(lower))) {
    const holder = holders.get(doorId)

    if (holder && lower(holder.productLotId) === lot) {
      continue
    }
    if (holder) {
      plan.end.push(holder.id)
      plan.moves.push({ doorId, fromLotId: holder.productLotId })
    }

    plan.start.push(doorId)
  }

  for (const doorId of new Set(withdraw.map(lower))) {
    const holder = holders.get(doorId)

    if (holder && lower(holder.productLotId) === lot) {
      plan.end.push(holder.id)
    }
  }

  return plan
}

type ChangePair = { add: string[]; remove: string[] }

export type ShiftCheckpointPlan = {
  endDoors: string[]
  startDoors: string[]
  endAreas: string[]
  startAreas: string[]
  issues: PreparationIssue[]
}

/**
 * Applies one resource kind's change pair to a shift's current selections of that kind: a resource
 * already there stays as it is, and one the shift does not have is not removed.
 */
function planSelectionChanges(
  pair: ChangePair,
  current: Array<{ id: string; resourceId: string }>,
) {
  const byResource = new Map(current.map((selection) => [lower(selection.resourceId), selection]))
  const start = [...new Set(pair.add.map(lower))].filter((id) => !byResource.has(id))
  const end = [...new Set(pair.remove.map(lower))].flatMap((id) => {
    const selection = byResource.get(id)

    return selection ? [selection.id] : []
  })

  return { start, end }
}

/**
 * Applies a shift's checkpoint change set to its current selections. Nothing is inherited from or
 * written to another shift: the caller passes this shift's selections only.
 */
export function planShiftCheckpointChanges({
  warehouseDoors,
  weighingAreas,
  currentSelections,
  assignedDoorIds,
  areasById,
}: {
  warehouseDoors: ChangePair
  weighingAreas: ChangePair
  currentSelections: {
    warehouseDoors: Array<{ id: string; warehouseDoorId: string }>
    weighingAreas: Array<{ id: string; weighingAreaId: string }>
  }
  /** The doors currently assigned to a lot of the shift's discharge. */
  assignedDoorIds: string[]
  areasById: Map<string, { status: ResourceStatus }>
}): ShiftCheckpointPlan {
  const assigned = new Set(assignedDoorIds.map(lower))
  const issues = [
    ...warehouseDoors.add.flatMap((id, index) =>
      assigned.has(lower(id)) ? [] : [unassignedWarehouseDoorIssue(`warehouseDoors.add.${index}`)],
    ),
    ...weighingAreas.add.flatMap((id, index) =>
      areasById.get(lower(id))?.status === 'AVAILABLE'
        ? []
        : [unavailableWeighingAreaIssue(`weighingAreas.add.${index}`)],
    ),
  ]

  const doors = planSelectionChanges(
    warehouseDoors,
    currentSelections.warehouseDoors.map((selection) => ({
      id: selection.id,
      resourceId: selection.warehouseDoorId,
    })),
  )
  const areas = planSelectionChanges(
    weighingAreas,
    currentSelections.weighingAreas.map((selection) => ({
      id: selection.id,
      resourceId: selection.weighingAreaId,
    })),
  )

  return {
    endDoors: doors.end,
    startDoors: doors.start,
    endAreas: areas.end,
    startAreas: areas.start,
    issues,
  }
}
