import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { Decimal } from 'decimal.js'

import { ProductLotSchema } from '#database/schema'
import Customer from '#models/customer'
import Discharge from '#models/discharge'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

export default class ProductLot extends ProductLotSchema {
  static selfAssignPrimaryKey = true

  @column({
    consume: (value) => new Decimal(value),
    prepare: (value: Decimal.Value) => new Decimal(value).toString(),
  })
  // The generated schema declares decimal columns as strings; this model override
  // intentionally replaces the runtime representation with Decimal.
  // @ts-expect-error Lucid model override narrows the generated persistence type.
  declare expectedQuantityTonnes: Decimal

  @belongsTo(() => Discharge)
  declare discharge: BelongsTo<typeof Discharge>

  @belongsTo(() => Customer)
  declare customer: BelongsTo<typeof Customer>

  @hasMany(() => WarehouseDoorProductLotAssignment)
  declare doorAssignments: HasMany<typeof WarehouseDoorProductLotAssignment>

  @beforeCreate()
  static assignId(productLot: ProductLot) {
    productLot.id ??= randomUUID()
  }
}
