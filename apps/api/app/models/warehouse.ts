import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { WarehouseSchema } from '#database/schema'
import User from '#models/user'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

export const WAREHOUSE_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number]

export default class Warehouse extends WarehouseSchema {
  static selfAssignPrimaryKey = true

  declare status: WarehouseStatus
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

  @hasMany(() => WarehouseFootprintPoint, { foreignKey: 'warehouseId' })
  declare footprintPoints: HasMany<typeof WarehouseFootprintPoint>

  @hasMany(() => WarehouseDoor, { foreignKey: 'warehouseId' })
  declare doors: HasMany<typeof WarehouseDoor>

  @beforeCreate()
  static assignId(warehouse: Warehouse) {
    warehouse.id ??= randomUUID()
  }
}
