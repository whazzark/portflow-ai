import { randomUUID } from 'node:crypto'

import { beforeCreate } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

import { CustomerSchema } from '#database/schema'

export const CUSTOMER_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export default class Customer extends CustomerSchema {
  static selfAssignPrimaryKey = true

  declare status: CustomerStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  @beforeCreate()
  static assignId(customer: Customer) {
    customer.id ??= randomUUID()
  }
}
