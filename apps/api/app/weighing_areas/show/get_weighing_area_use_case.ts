import { inject } from '@adonisjs/core'

import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'
import { WeighingAreaNotFoundException } from '#weighing_areas/shared/weighing_area_exceptions'

@inject()
export default class GetWeighingAreaUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  async handle(id: string) {
    const area = await this.repository.findById(id)

    if (!area) {
      throw new WeighingAreaNotFoundException()
    }

    return area
  }
}
