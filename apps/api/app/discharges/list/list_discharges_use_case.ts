import { inject } from '@adonisjs/core'

import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

@inject()
export default class ListDischargesUseCase {
  constructor(private dischargeRepository: DischargeRepository) {}

  handle() {
    return this.dischargeRepository.list()
  }
}
