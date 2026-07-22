import { randomUUID } from 'node:crypto'

import { beforeCreate } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

import { DockSchema } from '#database/schema'

export const DOCK_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type DockStatus = (typeof DOCK_STATUSES)[number]

export default class Dock extends DockSchema {
  static selfAssignPrimaryKey = true

  declare status: DockStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  @beforeCreate()
  static assignId(dock: Dock) {
    dock.id ??= randomUUID()
  }
}
