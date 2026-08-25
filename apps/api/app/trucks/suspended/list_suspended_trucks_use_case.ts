import { inject } from '@adonisjs/core'

import TruckRepository from '#trucks/shared/repositories/truck_repository'

@inject()
export default class ListSuspendedTrucksUseCase {
  constructor(private truckRepository: TruckRepository) {}

  handle() {
    return this.truckRepository.listSuspended()
  }
}
