import { randomUUID } from 'node:crypto'
import { beforeCreate, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { WarehouseSchema } from '#database/schema'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

export const WAREHOUSE_STATUSES = ['AVAILABLE', 'ARCHIVED'] as const
export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number]

export default class Warehouse extends WarehouseSchema {
  static selfAssignPrimaryKey = true

  declare status: WarehouseStatus

  @hasMany(() => WarehouseFootprintPoint, { foreignKey: 'warehouseId' })
  declare footprintPoints: HasMany<typeof WarehouseFootprintPoint>

  @beforeCreate()
  static assignId(warehouse: Warehouse) {
    warehouse.id ??= randomUUID()
  }
}
