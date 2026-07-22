import { inject } from '@adonisjs/core'

import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'

@inject()
export default class ListAvailableWeighingAreasUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  handle() {
    return this.repository.listAvailable()
  }
}
