import { BaseTransformer } from '@adonisjs/core/transformers'

import type User from '#models/user'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'firstName',
      'lastName',
      'email',
      'role',
      'accessStatus',
      'invitedAt',
      'activatedAt',
      'cancelledAt',
      'deactivatedAt',
      'reactivatedAt',
      // biome-ignore lint/security/noSecrets: field name, not a secret
      'invitedByUserId',
      'activatedByUserId',
      'cancelledByUserId',
      'deactivatedByUserId',
      'reactivatedByUserId',
    ])
  }
}
