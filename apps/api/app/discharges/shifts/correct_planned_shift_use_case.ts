import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  ShiftNotFoundException,
  ShiftNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import {
  ineligibleShiftResponsibleIssue,
  throwPreparationIssues,
} from '#discharges/shared/discharge_preparation_issues'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import {
  findShiftPeriodIssues,
  planShiftSequences,
  planShiftWarehouseDoorSelection,
  planShiftWeighingAreaSelection,
} from '#discharges/shared/planned_shift_rules'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import { planShiftSelection } from '#discharges/shared/truck_pool_rules'
import { isEligibleShiftResponsible } from '#users/shared/shift_responsible_eligibility'

export type CorrectPlannedShiftInput = {
  dischargeId: string
  shiftId: string
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsibleUserId: string
  truckIds: string[]
  warehouseDoorIds: string[]
  weighingAreaIds: string[]
}

/** The requested resources the shift does not hold yet: the only ones a correction locks. */
function newlySelected(requested: string[], currentSelection: Array<{ resourceId: string }>) {
  const selected = new Set(currentSelection.map((row) => row.resourceId.toLowerCase()))

  return requested.filter((id) => !selected.has(id.toLowerCase()))
}

/** Whether a selection plan changes nothing, which a replay of the same correction plans. */
const isUnchanged = (plan: { deleteIds: string[]; inserts: unknown[] }) =>
  plan.deleteIds.length === 0 && plan.inserts.length === 0

@inject()
export default class CorrectPlannedShiftUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Corrects everything planned for one shift in one transaction: its period, its responsible, and
   * its trucks, warehouse doors, and weighing areas.
   *
   * The shifts, the pool, and the current selections are read under the discharge's lock, which
   * every writer of them takes first. The responsible is locked, then only the trucks, doors, and
   * weighing areas being added, in the order every preparation write takes them: a resource that
   * stays selected needs no check, and may stay even if it has been archived or suspended since.
   * Every refusal is collected before one is thrown, so the form learns them all at once.
   *
   * The selections are not dated again when the period moves: a planned membership records when the
   * resource was selected, not when the shift will use it.
   */
  async handle(input: CorrectPlannedShiftInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const shift = await this.preparationRepository.findShift(discharge.id, input.shiftId, client)

      if (!shift) {
        throw new ShiftNotFoundException()
      }
      if (shift.status !== 'PLANNED') {
        throw new ShiftNotPlannedException()
      }

      const shifts = await this.preparationRepository.listShifts(discharge.id, client)
      const current = shifts.find((row) => row.id === shift.id)
      if (!current) {
        throw new Error(`Shift ${shift.id} is missing from its discharge while its lock is held`)
      }
      const issues = findShiftPeriodIssues(
        input,
        shifts.filter((row) => row.id !== shift.id),
      )

      const users = await this.preparationRepository.lockUsers([input.responsibleUserId], client)
      const responsible = users.get(input.responsibleUserId.toLowerCase())
      if (!responsible || !isEligibleShiftResponsible(responsible)) {
        issues.push(ineligibleShiftResponsibleIssue('responsibleUserId'))
      }

      const now = DateTime.utc()
      const trucks = await this.planTrucks(discharge.id, shift.id, input.truckIds, now, client)
      const warehouseDoors = await this.planWarehouseDoors(
        shift.id,
        input.warehouseDoorIds,
        now,
        client,
      )
      const weighingAreas = await this.planWeighingAreas(
        shift.id,
        input.weighingAreaIds,
        now,
        client,
      )

      if (
        issues.length > 0 ||
        trucks.kind === 'ISSUES' ||
        warehouseDoors.kind === 'ISSUES' ||
        weighingAreas.kind === 'ISSUES'
      ) {
        throwPreparationIssues([
          ...issues,
          ...[trucks, warehouseDoors, weighingAreas].flatMap((plan) =>
            plan.kind === 'ISSUES' ? plan.issues : [],
          ),
        ])
        return
      }

      const sequences = planShiftSequences(shifts, { id: shift.id, ...input })
      const plannedUnchanged =
        current.plannedStartAt.toMillis() === input.plannedStartAt.toMillis() &&
        current.plannedEndAt.toMillis() === input.plannedEndAt.toMillis() &&
        current.responsibleUserId.toLowerCase() === input.responsibleUserId.toLowerCase()
      if (
        plannedUnchanged &&
        isUnchanged(trucks) &&
        isUnchanged(warehouseDoors) &&
        isUnchanged(weighingAreas)
      ) {
        return
      }

      if (!isUnchanged(trucks)) {
        await this.preparationRepository.writeShiftTruckSelection(
          {
            dischargeId: discharge.id,
            shiftId: shift.id,
            deleteIds: trucks.deleteIds,
            inserts: trucks.inserts,
          },
          client,
        )
      }
      await this.preparationRepository.writePlannedShiftCorrection(
        {
          dischargeId: discharge.id,
          shiftId: shift.id,
          plannedStartAt: input.plannedStartAt,
          plannedEndAt: input.plannedEndAt,
          responsibleUserId: input.responsibleUserId,
          sequences,
          warehouseDoors: {
            deleteIds: warehouseDoors.deleteIds,
            inserts: warehouseDoors.inserts,
          },
          weighingAreas: { deleteIds: weighingAreas.deleteIds, inserts: weighingAreas.inserts },
        },
        client,
      )
    })

    const read = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!read) {
      throw new DischargeNotFoundException()
    }

    return read
  }

  /**
   * The shift's truck selection, decided as the shift trucks command decides it: on the discharge's
   * pool, locking only the held trucks it adds.
   */
  private async planTrucks(
    dischargeId: string,
    shiftId: string,
    truckIds: string[],
    now: DateTime,
    client: TransactionClientContract,
  ) {
    const pool = await this.preparationRepository.listTruckPool(dischargeId, client)
    const heldTruckIds = new Set(
      pool.filter((row) => row.releasedAt === null).map((row) => row.truckId.toLowerCase()),
    )
    const selections = await this.preparationRepository.listCurrentShiftTruckSelections(
      dischargeId,
      client,
    )
    const currentSelection = selections.filter((row) => row.shiftId === shiftId)
    const selectedIds = new Set(currentSelection.map((row) => row.truckId.toLowerCase()))
    const addedIds = truckIds.filter(
      (id) => heldTruckIds.has(id.toLowerCase()) && !selectedIds.has(id.toLowerCase()),
    )
    const addedTrucks =
      addedIds.length > 0
        ? await this.preparationRepository.lockTrucks(addedIds, client)
        : new Map()

    return planShiftSelection(truckIds, heldTruckIds, currentSelection, addedTrucks, now)
  }

  private async planWarehouseDoors(
    shiftId: string,
    warehouseDoorIds: string[],
    now: DateTime,
    client: TransactionClientContract,
  ) {
    const currentSelection = await this.preparationRepository.listCurrentShiftWarehouseDoors(
      shiftId,
      client,
    )
    const addedIds = newlySelected(warehouseDoorIds, currentSelection)
    const addedDoors =
      addedIds.length > 0
        ? await this.preparationRepository.lockWarehouseDoors(addedIds, client)
        : new Map()

    return planShiftWarehouseDoorSelection(warehouseDoorIds, currentSelection, addedDoors, now)
  }

  private async planWeighingAreas(
    shiftId: string,
    weighingAreaIds: string[],
    now: DateTime,
    client: TransactionClientContract,
  ) {
    const currentSelection = await this.preparationRepository.listCurrentShiftWeighingAreas(
      shiftId,
      client,
    )
    const addedIds = newlySelected(weighingAreaIds, currentSelection)
    const addedAreas =
      addedIds.length > 0
        ? await this.preparationRepository.lockWeighingAreas(addedIds, client)
        : new Map()

    return planShiftWeighingAreaSelection(weighingAreaIds, currentSelection, addedAreas, now)
  }
}
