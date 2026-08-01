import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ListWarehousesUseCase from '#warehouses/list/list_warehouses_use_case'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'
import WarehouseTransformer from '#warehouses/shared/warehouse_transformer'

@inject()
export default class WarehousesController {
  constructor(private listWarehousesUseCase: ListWarehousesUseCase) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('list')
    const warehouses = await this.listWarehousesUseCase.handle()
    return serialize(WarehouseTransformer.transform(warehouses))
  }
}
