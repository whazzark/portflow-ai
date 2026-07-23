import { BaseTransformer } from '@adonisjs/core/transformers'

import type WeighingArea from '#models/weighing_area'

export default class WeighingAreaTransformer extends BaseTransformer<WeighingArea> {
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
