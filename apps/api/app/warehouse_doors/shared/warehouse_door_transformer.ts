import { BaseTransformer } from '@adonisjs/core/transformers'
import type WarehouseDoor from '#models/warehouse_door'

export default class WarehouseDoorTransformer extends BaseTransformer<WarehouseDoor> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'warehouseId',
      'name',
      'status',
      'latitude',
      'longitude',
    ])
  }
}
