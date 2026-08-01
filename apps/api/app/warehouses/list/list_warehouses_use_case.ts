import { inject } from '@adonisjs/core'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'

@inject()
export default class ListWarehousesUseCase {
  constructor(private warehouseRepository: WarehouseRepository) {}

  handle() {
    return this.warehouseRepository.list()
  }
}
