import { BaseTransformer } from '@adonisjs/core/transformers'

import type Dock from '#models/dock'

export default class DockTransformer extends BaseTransformer<Dock> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'name',
      'latitude',
      'longitude',
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
