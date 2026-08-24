import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListAvailableTrucksUseCase from '#trucks/available/list_available_trucks_use_case'
import CreateTruckUseCase from '#trucks/create/create_truck_use_case'
import ListTrucksUseCase from '#trucks/list/list_trucks_use_case'
import TruckPolicy from '#trucks/shared/truck_policy'
import TruckTransformer from '#trucks/shared/truck_transformer'
import { createTruckValidator, updateTruckValidator } from '#trucks/shared/truck_validator'
import UpdateTruckUseCase from '#trucks/update/update_truck_use_case'

@inject()
export default class TrucksController {
  constructor(
    private listTrucksUseCase: ListTrucksUseCase,
    private listAvailableTrucksUseCase: ListAvailableTrucksUseCase,
    private createTruckUseCase: CreateTruckUseCase,
    private updateTruckUseCase: UpdateTruckUseCase,
  ) {}

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('create')

    const payload = await request.validateUsing(createTruckValidator)

    const truck = await this.createTruckUseCase.handle({
      registration: payload.registration,
      vehicleModel: payload.vehicleModel ?? null,
      capacityTonnes: payload.capacityTonnes,
      transportCompanyId: payload.transportCompanyId,
    })

    response.status(201)

    return serialize(TruckTransformer.transform(truck))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('update')

    const payload = await request.validateUsing(updateTruckValidator)

    const truck = await this.updateTruckUseCase.handle({
      id: params.id,
      registration: payload.registration,
      vehicleModel: payload.vehicleModel,
      capacityTonnes: payload.capacityTonnes,
      transportCompanyId: payload.transportCompanyId,
    })

    return serialize(TruckTransformer.transform(truck))
  }

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
