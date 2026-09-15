import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import { planWithdrawal } from '#discharges/shared/truck_pool_rules'

export type WithdrawTrucksInput = {
  dischargeId: string
  truckIds: string[]
}

@inject()
export default class WithdrawTrucksUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Takes no truck lock: ending a discharge's use of a truck can break no truck rule, and the
   * pool and its selections are only ever written under the discharge's lock taken here.
   */
  async handle(input: WithdrawTrucksInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const pool = await this.preparationRepository.listTruckPool(discharge.id, client)
      const selections = await this.preparationRepository.listCurrentShiftTruckSelections(
        discharge.id,
        client,
      )
      const plan = planWithdrawal(input.truckIds, pool, selections)

      if (plan.assignmentIds.length === 0 && plan.selectionIds.length === 0) {
        return
      }

      await this.preparationRepository.deleteTruckWithdrawal(
        { dischargeId: discharge.id, ...plan },
        client,
      )
    })

    const read = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!read) {
      throw new DischargeNotFoundException()
    }

    return read
  }
}
