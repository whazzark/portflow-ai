import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { WarehouseDoorSchema } from '#database/schema'
import Warehouse from '#models/warehouse'

export const WAREHOUSE_DOOR_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type WarehouseDoorStatus = (typeof WAREHOUSE_DOOR_STATUSES)[number]

export default class WarehouseDoor extends WarehouseDoorSchema {
  static selfAssignPrimaryKey = true

  declare status: WarehouseDoorStatus

  @belongsTo(() => Warehouse, { foreignKey: 'warehouseId' })
  declare warehouse: BelongsTo<typeof Warehouse>

  @beforeCreate()
  static assignId(door: WarehouseDoor) {
    door.id ??= randomUUID()
  }
}
