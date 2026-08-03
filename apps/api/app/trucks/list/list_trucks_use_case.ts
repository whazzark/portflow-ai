import { inject } from '@adonisjs/core'

import TruckRepository from '#trucks/shared/repositories/truck_repository'

@inject()
export default class ListTrucksUseCase {
  constructor(private truckRepository: TruckRepository) {}

  handle() {
    return this.truckRepository.list()
  }
}
