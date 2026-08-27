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
      // Creation is the first writer of this column, and the 201 response is where an administrator
      // observes it. Additive for the available-doors collection, and deliberately not mirrored onto
      // the doors embedded by `WarehouseTransformer`: no consultation surface renders it.
      'createdAt',
      // The 200 from an update is where an administrator observes that the correction was
      // recorded. Additive for the available-doors collection and for #213's 201, and deliberately
      // not mirrored onto the doors embedded by `WarehouseTransformer`: no consultation surface
      // renders it.
      'updatedAt',
    ])
  }
}
