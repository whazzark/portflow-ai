import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ListAvailableWarehouseDoorsUseCase from '#warehouse_doors/available/list_available_warehouse_doors_use_case'
import CreateWarehouseDoorUseCase from '#warehouse_doors/create/create_warehouse_door_use_case'
import WarehouseDoorPolicy from '#warehouse_doors/shared/warehouse_door_policy'
import WarehouseDoorTransformer from '#warehouse_doors/shared/warehouse_door_transformer'
import {
  createWarehouseDoorValidator,
  updateWarehouseDoorValidator,
} from '#warehouse_doors/shared/warehouse_door_validator'
import UpdateWarehouseDoorUseCase from '#warehouse_doors/update/update_warehouse_door_use_case'

@inject()
export default class WarehouseDoorsController {
  constructor(
    private listAvailableWarehouseDoorsUseCase: ListAvailableWarehouseDoorsUseCase,
    private createWarehouseDoorUseCase: CreateWarehouseDoorUseCase,
    private updateWarehouseDoorUseCase: UpdateWarehouseDoorUseCase,
  ) {}

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('create')

    const payload = await request.validateUsing(createWarehouseDoorValidator)

    const door = await this.createWarehouseDoorUseCase.handle(payload)

    response.status(201)

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('update')

    const payload = await request.validateUsing(updateWarehouseDoorValidator)

    const door = await this.updateWarehouseDoorUseCase.handle({ id: params.id, ...payload })

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('listAvailable')
    const doors = await this.listAvailableWarehouseDoorsUseCase.handle()
    return serialize(WarehouseDoorTransformer.transform(doors))
  }
}
