import { BaseTransformer } from '@adonisjs/core/transformers'

import type Truck from '#models/truck'
import UserTransformer from '#users/shared/transformers/user_transformer'

export default class TruckTransformer extends BaseTransformer<Truck> {
  /**
   * The truck as an operational user may read it: everything the administration view carries
   * except who acted on its lifecycle. A suspended truck's date and comment explain why it is no
   * longer offered, which is what FR-016 asks for; naming the responsible administrator is
   * administration context and stays behind the administrator-only collections (FR-015).
   */
  toOperationalView() {
    const truck = this.pick(this.resource, [
      'id',
      'registration',
      'vehicleModel',
      'transportCompanyId',
      'status',
      'archivedAt',
      'archiveComment',
      'reactivatedAt',
      'reactivationComment',
      'suspendedAt',
      'suspensionComment',
      'returnedToServiceAt',
      'returnToServiceComment',
      'createdAt',
      'updatedAt',
    ])

    return { ...truck, capacityTonnes: Number(this.resource.capacityTonnes) }
  }

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
      'suspendedAt',
      'suspendedByUserId',
      'suspensionComment',
      'returnedToServiceAt',
      // biome-ignore lint/security/noSecrets: identifier field, not a secret
      'returnedToServiceByUserId',
      'returnToServiceComment',
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
      suspendedBy: this.resource.suspendedBy
        ? UserTransformer.transform(this.resource.suspendedBy).useVariant('toSummary')
        : null,
      returnedToServiceBy: this.resource.returnedToServiceBy
        ? UserTransformer.transform(this.resource.returnedToServiceBy).useVariant('toSummary')
        : null,
    }
  }
}
