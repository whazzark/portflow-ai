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
      // The 200 from an archival (#215) is where an administrator observes what was recorded — a
      // response stating `status: 'ARCHIVED'` and nothing else would omit the one thing the request
      // just wrote. `archivedWithWarehouse` travels with them because it is what separates a door
      // retired on its own from one caught by its warehouse's cascade (#210), and so what decides
      // whether a warehouse reactivation (#211) brings it back.
      //
      // The reactivation members are #216's to add: no writer sets them yet, and a field that is
      // always null invites a client to render an empty "Reactivated by".
      'archivedAt',
      // biome-ignore lint/security/noSecrets: identifier field, not a secret
      'archivedByUserId',
      'archiveComment',
      'archivedWithWarehouse',
    ])
  }
}
