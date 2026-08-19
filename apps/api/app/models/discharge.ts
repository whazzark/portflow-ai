import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { DischargeSchema } from '#database/schema'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import Dock from '#models/dock'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

export const DISCHARGE_STATUSES = ['PLANNED', 'ACTIVE', 'CLOSED'] as const
export type DischargeStatus = (typeof DISCHARGE_STATUSES)[number]

export default class Discharge extends DischargeSchema {
  static selfAssignPrimaryKey = true

  declare status: DischargeStatus

  @belongsTo(() => Dock)
  declare dock: BelongsTo<typeof Dock>

  @hasMany(() => ProductLot)
  declare productLots: HasMany<typeof ProductLot>

  @hasMany(() => DischargeTruckAssignment)
  declare truckAssignments: HasMany<typeof DischargeTruckAssignment>

  @hasMany(() => Shift)
  declare shifts: HasMany<typeof Shift>

  @hasMany(() => WarehouseDoorProductLotAssignment)
  declare doorAssignments: HasMany<typeof WarehouseDoorProductLotAssignment>

  @beforeCreate()
  static assignId(discharge: Discharge) {
    discharge.id ??= randomUUID()
  }
}
