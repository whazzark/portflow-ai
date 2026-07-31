import { randomUUID } from 'node:crypto'

import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import { TransportCompanySchema } from '#database/schema'
import User from '#models/user'

export const TRANSPORT_COMPANY_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type TransportCompanyStatus = (typeof TRANSPORT_COMPANY_STATUSES)[number]

export default class TransportCompany extends TransportCompanySchema {
  static selfAssignPrimaryKey = true

  declare status: TransportCompanyStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  // biome-ignore lint/security/noSecrets: database column name, not a secret
  @belongsTo(() => User, { foreignKey: 'archivedByUserId' })
  declare archivedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reactivatedByUserId' })
  declare reactivatedBy: BelongsTo<typeof User>

  @beforeCreate()
  static assignId(company: TransportCompany) {
    company.id ??= randomUUID()
  }
}
