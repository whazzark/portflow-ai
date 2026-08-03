import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import ListAvailableWarehouseDoorsUseCase from '#warehouse_doors/available/list_available_warehouse_doors_use_case'
import WarehouseDoorPolicy from '#warehouse_doors/shared/warehouse_door_policy'
import WarehouseDoorTransformer from '#warehouse_doors/shared/warehouse_door_transformer'

@inject()
export default class WarehouseDoorsController {
  constructor(private listAvailableWarehouseDoorsUseCase: ListAvailableWarehouseDoorsUseCase) {}

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('listAvailable')
    const doors = await this.listAvailableWarehouseDoorsUseCase.handle()
    return serialize(WarehouseDoorTransformer.transform(doors))
  }
}
