import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { DischargeTruckAssignmentSchema } from '#database/schema'
import Discharge from '#models/discharge'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'

export default class DischargeTruckAssignment extends DischargeTruckAssignmentSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => Discharge)
  declare discharge: BelongsTo<typeof Discharge>

  @belongsTo(() => Truck)
  declare truck: BelongsTo<typeof Truck>

  @belongsTo(() => TransportCompany)
  declare transportCompany: BelongsTo<typeof TransportCompany>

  @beforeCreate()
  static assignId(assignment: DischargeTruckAssignment) {
    assignment.id ??= randomUUID()
  }
}
