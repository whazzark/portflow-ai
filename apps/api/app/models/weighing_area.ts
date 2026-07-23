import { randomUUID } from 'node:crypto'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

import { WeighingAreaSchema } from '#database/schema'

export const WEIGHING_AREA_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type WeighingAreaStatus = (typeof WEIGHING_AREA_STATUSES)[number]

export default class WeighingArea extends WeighingAreaSchema {
  static selfAssignPrimaryKey = true

  declare status: WeighingAreaStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  @beforeCreate()
  static assignId(area: WeighingArea) {
    area.id ??= randomUUID()
  }
}
