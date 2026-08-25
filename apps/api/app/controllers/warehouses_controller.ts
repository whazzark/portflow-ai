import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import CreateWarehouseUseCase from '#warehouses/create/create_warehouse_use_case'
import ListWarehousesUseCase from '#warehouses/list/list_warehouses_use_case'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'
import WarehouseTransformer from '#warehouses/shared/warehouse_transformer'
import { createWarehouseValidator } from '#warehouses/shared/warehouse_validator'

@inject()
export default class WarehousesController {
  constructor(
    private listWarehousesUseCase: ListWarehousesUseCase,
    private createWarehouseUseCase: CreateWarehouseUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('list')
    const warehouses = await this.listWarehousesUseCase.handle()
    return serialize(WarehouseTransformer.transform(warehouses))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('create')

    const payload = await request.validateUsing(createWarehouseValidator)

    const warehouse = await this.createWarehouseUseCase.handle({
      name: payload.name,
      points: payload.footprint.points,
    })

    response.status(201)

    return serialize(WarehouseTransformer.transform(warehouse))
  }
}
