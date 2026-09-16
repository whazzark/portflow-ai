import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  DischargePlanningConflictException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
import { throwPreparationIssues } from '#discharges/shared/discharge_preparation_issues'
import {
  listOverlapIssues,
  planLotDoorChanges,
  recordedInstant,
} from '#discharges/shared/discharge_resource_planning_rules'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type ChangeLotWarehouseDoorsInput = {
  dischargeId: string
  productLotId: string
  assign: string[]
  withdraw: string[]
}

@inject()
export default class ChangeLotWarehouseDoorsUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Applies a change set rather than a final list of doors: two preparers planning one discharge
   * each change only what they changed, and a replayed save finds its changes already applied.
   *
   * Rows are ended before new ones start, so a door moved between two lots is never current on
   * both, even for the length of a statement.
   */
  async handle(input: ChangeLotWarehouseDoorsInput) {
    const assign = input.assign.map((id) => id.toLowerCase())
    const withdraw = input.withdraw.map((id) => id.toLowerCase())

    throwPreparationIssues(
      listOverlapIssues({ first: assign, second: withdraw, field: 'withdraw' }),
    )

    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const lots = await this.preparationRepository.listProductLots(discharge.id, client)
      const lot = lots.find((candidate) => candidate.id === input.productLotId.toLowerCase())

      if (!lot) {
        throw new ProductLotNotFoundException()
      }

      const currentAssignments = await this.preparationRepository.listCurrentDoorAssignments(
        discharge.id,
        client,
      )
      const doorsById = await this.preparationRepository.lockWarehouseDoors(assign, client)
      const plannedShiftIds = new Set(
        (await this.preparationRepository.listShifts(discharge.id, client))
          .filter((shift) => shift.status === 'PLANNED')
          .map((shift) => shift.id),
      )
      const selections = await this.preparationRepository.listCurrentShiftSelections(
        discharge.id,
        client,
      )

      const plan = planLotDoorChanges({
        lotId: lot.id,
        assign,
        withdraw,
        currentAssignments,
        doorsById,
        plannedShiftDoorIds: selections.warehouseDoors
          .filter((selection) => plannedShiftIds.has(selection.shiftId))
          .map((selection) => selection.warehouseDoorId),
      })
      throwPreparationIssues(plan.issues)

      if (plan.end.length === 0 && plan.start.length === 0) {
        return
      }

      const instant = recordedInstant(
        DateTime.now(),
        await this.preparationRepository.latestDoorAssignmentTime(discharge.id, client),
      )
      await this.preparationRepository.endRows('DOOR_ASSIGNMENT', plan.end, instant, client)
      const result = await this.preparationRepository.startDoorAssignments(
        plan.start.map((warehouseDoorId) => ({
          dischargeId: discharge.id,
          productLotId: lot.id,
          warehouseDoorId,
        })),
        instant,
        client,
      )

      if (result.kind === 'CURRENT_ROW_CONFLICT') {
        throw new DischargePlanningConflictException()
      }
    })

    const discharge = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
