import { inject } from '@adonisjs/core'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type ShowDischargeInput = {
  id: string
}

@inject()
export default class ShowDischargeUseCase {
  constructor(private dischargeRepository: DischargeRepository) {}

  async handle(input: ShowDischargeInput) {
    const discharge = await this.dischargeRepository.findDetail(input.id)

    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
