import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import {
  planShiftWarehouseDoorSelection,
  planShiftWeighingAreaSelection,
} from '#discharges/shared/planned_shift_rules'
import { planShiftTruckSelection } from '#discharges/shared/planned_shift_trucks'
import type DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'

export type PlannedShiftResourcesSelection = {
  dischargeId: string
  /** A shift not written yet has no current selection, so every requested resource is new. */
  shiftId: string
  truckIds: string[]
  warehouseDoorIds: string[]
  weighingAreaIds: string[]
  now: DateTime
}

/** The requested resources the shift does not hold yet: the only ones a write locks. */
function newlySelected(requested: string[], currentSelection: Array<{ resourceId: string }>) {
  const selected = new Set(currentSelection.map((row) => row.resourceId.toLowerCase()))

  return requested.filter((id) => !selected.has(id.toLowerCase()))
}

/**
 * Decides a planned shift's trucks, warehouse doors, and weighing areas from the complete selections
 * requested. Adding a shift and correcting one decide them here, so a shift is never given a
 * resource by one that the other would refuse.
 *
 * The caller holds the discharge's lock. Only the resources being added are locked, in the order
 * every preparation write takes them: trucks, then warehouses and their doors, then weighing areas.
 * The refusals come back together, trucks first, so the form learns them all at once.
 */
export async function planPlannedShiftResources(
  repository: DischargePreparationRepository,
  selection: PlannedShiftResourcesSelection,
  client: TransactionClientContract,
) {
  const { dischargeId, shiftId, now } = selection

  const trucks = await planShiftTruckSelection(
    repository,
    { dischargeId, shiftId, truckIds: selection.truckIds, now },
    client,
  )

  const currentDoors = await repository.listCurrentShiftWarehouseDoors(shiftId, client)
  const addedDoorIds = newlySelected(selection.warehouseDoorIds, currentDoors)
  const addedDoors =
    addedDoorIds.length > 0 ? await repository.lockWarehouseDoors(addedDoorIds, client) : new Map()
  // Read under the discharge's lock, so an assignment withdrawn meanwhile cannot let a door
  // through: a newly selected door must be one a lot of this discharge holds now.
  const assignments = await repository.listCurrentDoorAssignments(dischargeId, client)
  const warehouseDoors = planShiftWarehouseDoorSelection(
    selection.warehouseDoorIds,
    currentDoors,
    addedDoors,
    assignments.map((assignment) => assignment.warehouseDoorId),
    now,
  )

  const currentAreas = await repository.listCurrentShiftWeighingAreas(shiftId, client)
  const addedAreaIds = newlySelected(selection.weighingAreaIds, currentAreas)
  const addedAreas =
    addedAreaIds.length > 0 ? await repository.lockWeighingAreas(addedAreaIds, client) : new Map()
  const weighingAreas = planShiftWeighingAreaSelection(
    selection.weighingAreaIds,
    currentAreas,
    addedAreas,
    now,
  )

  const issues = [trucks, warehouseDoors, weighingAreas].flatMap((plan) =>
    plan.kind === 'ISSUES' ? plan.issues : [],
  )

  return { trucks, warehouseDoors, weighingAreas, issues }
}
