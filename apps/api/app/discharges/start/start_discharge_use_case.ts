import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  DischargePlanningConflictException,
} from '#discharges/shared/discharge_exceptions'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import DischargeStartRepository from '#discharges/shared/repositories/discharge_start_repository'
import { DischargeStartRefusedException } from '#discharges/start/discharge_start_exceptions'
import {
  buildStartState,
  evaluateDischargeStart,
  startReferenceIds,
} from '#discharges/start/discharge_start_rules'

export type StartDischargeInput = { dischargeId: string; userId: string }

@inject()
export default class StartDischargeUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private startRepository: DischargeStartRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * The Discharge Start Confirmation: the discharge and its first shift become active together, or
   * nothing changes and every reason is reported.
   *
   * The discharge's lock keeps its own plan still. The claims on its dock, trucks, and doors make a
   * start sharing one of them wait for this one to commit; the active holders are only read once
   * every claim is held, so a discharge started meanwhile is read as a holder rather than missed.
   * No row of the plan is written: the pool, assignments, and selections become effective through
   * the discharge's status.
   */
  async handle(input: StartDischargeInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const plan = await this.startRepository.readStartPlan(discharge.id, client)
      const ids = startReferenceIds(discharge.dockId, plan)
      const references = await this.startRepository.readReferences(ids, 'CLAIM', client)
      const holders = await this.startRepository.findActiveHolders(
        {
          dischargeId: discharge.id,
          dockId: discharge.dockId,
          truckIds: plan.heldTruckIds,
          warehouseDoorIds: ids.warehouseDoorIds,
        },
        client,
      )
      const evaluation = evaluateDischargeStart(
        buildStartState(discharge.id, plan, references, holders),
      )

      if (evaluation.problems.length > 0 || evaluation.shiftId === null) {
        throw new DischargeStartRefusedException(evaluation)
      }

      const result = await this.startRepository.activate(
        {
          dischargeId: discharge.id,
          shiftId: evaluation.shiftId,
          userId: input.userId,
          instant: DateTime.utc().startOf('second'),
        },
        client,
      )

      if (result.kind === 'ACTIVE_ROW_CONFLICT') {
        throw new DischargePlanningConflictException()
      }
    })

    const read = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!read) {
      throw new DischargeNotFoundException()
    }

    return read
  }
}
