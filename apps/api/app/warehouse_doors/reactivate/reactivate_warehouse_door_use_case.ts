import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  WarehouseDoorAlreadyAvailableException,
  WarehouseDoorArchivedWithWarehouseException,
  WarehouseDoorNotFoundException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import { WarehouseNotFoundException } from '#warehouses/shared/warehouse_exceptions'

export type ReactivateWarehouseDoorInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateWarehouseDoorUseCase {
  constructor(private repository: WarehouseDoorRepository) {}

  async handle(input: ReactivateWarehouseDoorInput) {
    const result = await this.repository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      // Absent, empty, and whitespace-only all collapse to no comment, the rule every site
      // reference shares.
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'DOOR_NOT_FOUND') {
      throw new WarehouseDoorNotFoundException()
    }

    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new WarehouseDoorAlreadyAvailableException()
    }

    // The failing fact is the warehouse's, so the warehouse's own exception names it rather than a
    // door-flavoured duplicate — the rule `warehouse_door_exceptions.ts` states in its header.
    if (result.kind === 'WAREHOUSE_NOT_FOUND') {
      throw new WarehouseNotFoundException()
    }

    // The one place that rule bends, and the header says why: an archived warehouse holds no door
    // but those archived with it, so the door needs "reactivate the warehouse and it returns with
    // it" — guidance the warehouse's own read-only refusal, written for a write that must then be
    // resubmitted, does not give.
    if (result.kind === 'WAREHOUSE_ARCHIVED') {
      throw new WarehouseDoorArchivedWithWarehouseException()
    }

    return result.door
  }
}
