import { randomUUID } from 'node:crypto'

import { beforeCreate } from '@adonisjs/lucid/orm'

import { UserSchema } from '#database/schema'

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

  declare accessStatus: UserAccessStatus
  declare role: UserRole

  @beforeCreate()
  static assignId(user: User) {
    user.id ??= randomUUID()
  }
}
