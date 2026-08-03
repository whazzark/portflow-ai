import { randomUUID } from 'node:crypto'

import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

import { TruckSchema } from '#database/schema'
import TransportCompany from '#models/transport_company'
import User from '#models/user'

export const TRUCK_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type TruckStatus = (typeof TRUCK_STATUSES)[number]

export default class Truck extends TruckSchema {
  static selfAssignPrimaryKey = true

  declare status: TruckStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  @belongsTo(() => TransportCompany)
  declare transportCompany: BelongsTo<typeof TransportCompany>

  // biome-ignore lint/security/noSecrets: database column name, not a secret
  @belongsTo(() => User, { foreignKey: 'archivedByUserId' })
  declare archivedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reactivatedByUserId' })
  declare reactivatedBy: BelongsTo<typeof User>

  @beforeCreate()
  static assignId(truck: Truck) {
    truck.id ??= randomUUID()
  }
}
