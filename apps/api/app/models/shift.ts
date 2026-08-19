import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

import { ShiftSchema } from '#database/schema'
import Discharge from '#models/discharge'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import User from '#models/user'

export const SHIFT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const
export type ShiftStatus = (typeof SHIFT_STATUSES)[number]

export default class Shift extends ShiftSchema {
  static selfAssignPrimaryKey = true

  declare status: ShiftStatus

  @belongsTo(() => Discharge)
  declare discharge: BelongsTo<typeof Discharge>

  @belongsTo(() => User, { foreignKey: 'responsibleUserId' })
  declare responsible: BelongsTo<typeof User>

  @hasMany(() => ShiftTruck)
  declare truckMemberships: HasMany<typeof ShiftTruck>

  @hasMany(() => ShiftWarehouseDoor)
  declare warehouseDoorMemberships: HasMany<typeof ShiftWarehouseDoor>

  @hasMany(() => ShiftWeighingArea)
  declare weighingAreaMemberships: HasMany<typeof ShiftWeighingArea>

  @beforeCreate()
  static assignId(shift: Shift) {
    shift.id ??= randomUUID()
  }
}
