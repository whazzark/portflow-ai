import { BaseTransformer } from '@adonisjs/core/transformers'

import type Customer from '#models/customer'

export default class CustomerTransformer extends BaseTransformer<Customer> {
  toObject() {
    return this.pick(this.resource, [
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
  }
}
