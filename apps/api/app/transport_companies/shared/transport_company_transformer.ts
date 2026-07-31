import { BaseTransformer } from '@adonisjs/core/transformers'

import type TransportCompany from '#models/transport_company'
import UserTransformer from '#users/shared/transformers/user_transformer'

export default class TransportCompanyTransformer extends BaseTransformer<TransportCompany> {
  toObject() {
    const company = this.pick(this.resource, [
      'id',
      'name',
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
      ...company,
      archivedBy: this.resource.archivedBy
        ? UserTransformer.transform(this.resource.archivedBy).useVariant('toSummary')
        : null,
      reactivatedBy: this.resource.reactivatedBy
        ? UserTransformer.transform(this.resource.reactivatedBy).useVariant('toSummary')
        : null,
    }
  }
}
