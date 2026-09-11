import { randomUUID } from 'node:crypto'

import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { UserActivationTokenSchema } from '#database/schema'
import User from '#models/user'

/**
 * The digest of a pending user's confidential activation link, never the link itself. One row per
 * pending user — the unique index on `user_id` is what makes "exactly one live link" a property of
 * the database rather than of the code that writes it.
 */
export default class UserActivationToken extends UserActivationTokenSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static assignId(token: UserActivationToken) {
    token.id ??= randomUUID()
  }
}
