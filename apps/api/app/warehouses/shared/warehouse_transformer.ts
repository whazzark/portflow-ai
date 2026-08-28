import { BaseTransformer } from '@adonisjs/core/transformers'
import type Warehouse from '#models/warehouse'

export default class WarehouseTransformer extends BaseTransformer<Warehouse> {
  toObject() {
    if (this.resource.footprintPoints.length < 3) {
      throw new Error(`Warehouse ${this.resource.id} has an invalid footprint`)
    }

    return {
      id: this.resource.id,
      name: this.resource.name,
      status: this.resource.status,
      archivedAt: this.resource.archivedAt,
      archivedByUserId: this.resource.archivedByUserId,
      archiveComment: this.resource.archiveComment,
      reactivatedAt: this.resource.reactivatedAt,
      reactivatedByUserId: this.resource.reactivatedByUserId,
      reactivationComment: this.resource.reactivationComment,
      createdAt: this.resource.createdAt,
      updatedAt: this.resource.updatedAt,
      footprint: {
        points: this.resource.footprintPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })),
      },
      doors: this.resource.doors.map((door) => ({
        id: door.id,
        name: door.name,
        status: door.status,
        latitude: door.latitude,
        longitude: door.longitude,
        archivedAt: door.archivedAt,
        archivedByUserId: door.archivedByUserId,
        archiveComment: door.archiveComment,
        reactivatedAt: door.reactivatedAt,
        reactivatedByUserId: door.reactivatedByUserId,
        reactivationComment: door.reactivationComment,
      })),
    }
  }
}
