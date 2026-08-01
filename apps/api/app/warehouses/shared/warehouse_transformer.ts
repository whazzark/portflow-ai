import { BaseTransformer } from '@adonisjs/core/transformers'
import type Warehouse from '#models/warehouse'

export default class WarehouseTransformer extends BaseTransformer<Warehouse> {
  toObject() {
    return {
      id: this.resource.id,
      name: this.resource.name,
      status: this.resource.status,
      footprint: {
        points: this.resource.footprintPoints.map((point) => ({
          latitude: point.latitude,
          longitude: point.longitude,
        })),
      },
    }
  }
}
