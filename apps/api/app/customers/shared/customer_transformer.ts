import { BaseTransformer } from '@adonisjs/core/transformers'

import type Customer from '#models/customer'
import UserTransformer from '#users/shared/transformers/user_transformer'

export default class CustomerTransformer extends BaseTransformer<Customer> {
  toObject() {
    const customer = this.pick(this.resource, [
      'id',
      'code',
      'companyName',
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
      ...customer,
      archivedBy: this.resource.archivedBy
        ? UserTransformer.transform(this.resource.archivedBy).useVariant('toSummary')
        : null,
      reactivatedBy: this.resource.reactivatedBy
        ? UserTransformer.transform(this.resource.reactivatedBy).useVariant('toSummary')
        : null,
    }
  }
}
