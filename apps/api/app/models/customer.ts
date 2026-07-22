import { randomUUID } from 'node:crypto'

import { beforeCreate } from '@adonisjs/lucid/orm'

import { CustomerSchema } from '#database/schema'

export const CUSTOMER_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export default class Customer extends CustomerSchema {
  static selfAssignPrimaryKey = true

  declare status: CustomerStatus

  @beforeCreate()
  static assignId(customer: Customer) {
    customer.id ??= randomUUID()
  }
}
