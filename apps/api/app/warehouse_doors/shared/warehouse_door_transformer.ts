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
      // just wrote. Nothing states the provenance beside them: the containing warehouse's status
      // already says it, since an archived warehouse holds none but doors archived with it (#210).
      'archivedAt',
      // biome-ignore lint/security/noSecrets: identifier field, not a secret
      'archivedByUserId',
      'archiveComment',
      // The same reasoning one transition later: the 200 from a reactivation (#216) is where its
      // time, actor, and comment are observed. The archive members stay beside them rather than
      // being nulled — reactivation preserves the archive context, so the full lifecycle of a door
      // that came back is readable from one response.
      'reactivatedAt',
      'reactivatedByUserId',
      'reactivationComment',
    ])
  }
}
