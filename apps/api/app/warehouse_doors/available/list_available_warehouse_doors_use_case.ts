import { inject } from '@adonisjs/core'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'

@inject()
export default class ListAvailableWarehouseDoorsUseCase {
  constructor(private warehouseDoorRepository: WarehouseDoorRepository) {}

  handle() {
    return this.warehouseDoorRepository.listAvailable()
  }
}
