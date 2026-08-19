import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { ShiftTruckSchema } from '#database/schema'
import Shift from '#models/shift'
import Truck from '#models/truck'

export default class ShiftTruck extends ShiftTruckSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => Shift)
  declare shift: BelongsTo<typeof Shift>

  @belongsTo(() => Truck)
  declare truck: BelongsTo<typeof Truck>

  @beforeCreate()
  static assignId(membership: ShiftTruck) {
    membership.id ??= randomUUID()
  }
}
