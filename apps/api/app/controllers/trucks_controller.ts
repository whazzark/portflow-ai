import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListAvailableTrucksUseCase from '#trucks/available/list_available_trucks_use_case'
import ListTrucksUseCase from '#trucks/list/list_trucks_use_case'
import TruckPolicy from '#trucks/shared/truck_policy'
import TruckTransformer from '#trucks/shared/truck_transformer'

@inject()
export default class TrucksController {
  constructor(
    private listTrucksUseCase: ListTrucksUseCase,
    private listAvailableTrucksUseCase: ListAvailableTrucksUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('list')

    const trucks = await this.listTrucksUseCase.handle()

    return serialize(TruckTransformer.transform(trucks))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('listAvailable')

    const trucks = await this.listAvailableTrucksUseCase.handle()

    return serialize(TruckTransformer.transform(trucks))
  }
}
