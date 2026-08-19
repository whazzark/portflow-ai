import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { WarehouseDoorProductLotAssignmentSchema } from '#database/schema'
import Discharge from '#models/discharge'
import ProductLot from '#models/product_lot'
import WarehouseDoor from '#models/warehouse_door'

export default class WarehouseDoorProductLotAssignment extends WarehouseDoorProductLotAssignmentSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => Discharge)
  declare discharge: BelongsTo<typeof Discharge>

  @belongsTo(() => WarehouseDoor)
  declare warehouseDoor: BelongsTo<typeof WarehouseDoor>

  @belongsTo(() => ProductLot)
  declare productLot: BelongsTo<typeof ProductLot>

  @beforeCreate()
  static assignId(assignment: WarehouseDoorProductLotAssignment) {
    assignment.id ??= randomUUID()
  }
}
