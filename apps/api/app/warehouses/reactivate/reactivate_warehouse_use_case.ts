import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  WarehouseAlreadyAvailableException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

export type ReactivateWarehouseInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateWarehouseUseCase {
  constructor(private repository: WarehouseRepository) {}

  async handle(input: ReactivateWarehouseInput) {
    const result = await this.repository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new WarehouseNotFoundException()
    }

    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new WarehouseAlreadyAvailableException()
    }

    return { warehouse: result.warehouse, reactivatedDoorCount: result.reactivatedDoorCount }
  }
}
