import { inject } from '@adonisjs/core'

import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

@inject()
export default class ListDockOccupancyUseCase {
  constructor(private dischargeRepository: DischargeRepository) {}

  handle({ dockId }: { dockId: string }) {
    return this.dischargeRepository.listDockOccupancy(dockId)
  }
}
