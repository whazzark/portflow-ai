import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { WarehouseDoorSchema } from '#database/schema'
import User from '#models/user'
import Warehouse from '#models/warehouse'

export const WAREHOUSE_DOOR_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type WarehouseDoorStatus = (typeof WAREHOUSE_DOOR_STATUSES)[number]

export default class WarehouseDoor extends WarehouseDoorSchema {
  static selfAssignPrimaryKey = true

  declare status: WarehouseDoorStatus
  declare archivedAt: DateTime | null
  declare archivedByUserId: string | null
  declare archiveComment: string | null
  declare reactivatedAt: DateTime | null
  declare reactivatedByUserId: string | null
  declare reactivationComment: string | null

  // SQLite (the test database, per ADR 0002) stores booleans as 1/0 and hands them back as
  // integers, so callers comparing against `true`/`false` would silently disagree with PostgreSQL.
  // Normalizing on read keeps `archivedWithWarehouse` a real boolean on both engines.
  @column({ consume: (value) => Boolean(value) })
  declare archivedWithWarehouse: boolean

  @belongsTo(() => Warehouse, { foreignKey: 'warehouseId' })
  declare warehouse: BelongsTo<typeof Warehouse>

  // biome-ignore lint/security/noSecrets: database column name, not a secret
  @belongsTo(() => User, { foreignKey: 'archivedByUserId' })
  declare archivedBy: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'reactivatedByUserId' })
  declare reactivatedBy: BelongsTo<typeof User>

  @beforeCreate()
  static assignId(door: WarehouseDoor) {
    door.id ??= randomUUID()
  }
}
