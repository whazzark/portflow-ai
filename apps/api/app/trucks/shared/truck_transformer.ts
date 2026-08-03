import { BaseTransformer } from '@adonisjs/core/transformers'

import type Truck from '#models/truck'
import UserTransformer from '#users/shared/transformers/user_transformer'

export default class TruckTransformer extends BaseTransformer<Truck> {
  toObject() {
    const truck = this.pick(this.resource, [
      'id',
      'registration',
      'vehicleModel',
      'transportCompanyId',
      'status',
      'archivedAt',
      // biome-ignore lint/security/noSecrets: identifier field, not a secret
      'archivedByUserId',
      'archiveComment',
      'reactivatedAt',
      'reactivatedByUserId',
      'reactivationComment',
      'createdAt',
      'updatedAt',
    ])

    return {
      ...truck,
      capacityTonnes: Number(this.resource.capacityTonnes),
      archivedBy: this.resource.archivedBy
        ? UserTransformer.transform(this.resource.archivedBy).useVariant('toSummary')
        : null,
      reactivatedBy: this.resource.reactivatedBy
        ? UserTransformer.transform(this.resource.reactivatedBy).useVariant('toSummary')
        : null,
    }
  }
}
