import { randomUUID } from 'node:crypto'
import { beforeCreate, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

import { ShiftWeighingAreaSchema } from '#database/schema'
import Shift from '#models/shift'
import WeighingArea from '#models/weighing_area'

export default class ShiftWeighingArea extends ShiftWeighingAreaSchema {
  static selfAssignPrimaryKey = true

  @belongsTo(() => Shift)
  declare shift: BelongsTo<typeof Shift>

  @belongsTo(() => WeighingArea)
  declare weighingArea: BelongsTo<typeof WeighingArea>

  @beforeCreate()
  static assignId(membership: ShiftWeighingArea) {
    membership.id ??= randomUUID()
  }
}
