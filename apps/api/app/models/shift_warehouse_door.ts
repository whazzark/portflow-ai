import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { ShiftWarehouseDoorSchema } from '#database/schema'
import Shift from '#models/shift'
import WarehouseDoor from '#models/warehouse_door'

export default class ShiftWarehouseDoor extends ShiftWarehouseDoorSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => Shift)
  declare shift: BelongsTo<typeof Shift>

  @belongsTo(() => WarehouseDoor)
  declare warehouseDoor: BelongsTo<typeof WarehouseDoor>

  @beforeCreate()
  static assignId(membership: ShiftWarehouseDoor) {
    membership.id ??= randomUUID()
  }
}
