import { randomUUID } from 'node:crypto'

import { beforeCreate, belongsTo, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import FixedExpiryRememberMeTokensProvider from '#auth/shared/fixed_expiry_remember_me_tokens_provider'
import { UserSchema } from '#database/schema'
import UserActivationToken from '#models/user_activation_token'

export const USER_ACCESS_STATUSES = ['PENDING', 'ACTIVE', 'CANCELLED', 'DEACTIVATED'] as const
export type UserAccessStatus = (typeof USER_ACCESS_STATUSES)[number]

export const USER_ROLES = [
  'ORGANIZATION_ADMIN',
  'OPERATIONS_ADMIN',
  'OPERATIONS_LEAD',
  'OBSERVER',
] as const
export type UserRole = (typeof USER_ROLES)[number]

export default class User extends UserSchema {
  static selfAssignPrimaryKey = true

  static rememberMeTokens = new FixedExpiryRememberMeTokensProvider({ tokenableModel: User })

  declare accessStatus: UserAccessStatus
  declare role: UserRole

  // Self-referential: every lifecycle event may name the administrator who caused it, and each one
  // is nullable because an event can be recorded without an actor.
  // biome-ignore lint/security/noSecrets: database column name, not a secret
  @belongsTo(() => User, { foreignKey: 'invitedByUserId' })
  declare invitedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'activatedByUserId' })
  declare activatedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'cancelledByUserId' })
  declare cancelledBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'deactivatedByUserId' })
  declare deactivatedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reactivatedByUserId' })
  declare reactivatedBy: BelongsTo<typeof User>

  /**
   * The live activation link of a pending user, at most one. This slice only writes it; the
   * acceptance, renewal, cancellation, and restoration slices are the readers.
   */
  @hasOne(() => UserActivationToken)
  declare activationToken: HasOne<typeof UserActivationToken>

  @beforeCreate()
  static assignId(user: User) {
    user.id ??= randomUUID()
  }
}
