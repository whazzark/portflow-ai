import { inject } from '@adonisjs/core'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type ListPlanningOptionsInput = {
  dischargeId: string
}

@inject()
export default class ListPlanningOptionsUseCase {
  constructor(private dischargeRepository: DischargeRepository) {}

  /**
   * The discharge's status is not checked: reading choices changes nothing, and the planning
   * commands refuse a discharge that is no longer planned under their own lock.
   */
  async handle(input: ListPlanningOptionsInput) {
    const options = await this.dischargeRepository.findPlanningOptions(input.dischargeId)

    if (!options) {
      throw new DischargeNotFoundException()
    }

    return options
  }
}
