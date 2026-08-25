import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  WarehouseAlreadyArchivedException,
  WarehouseInUseException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

export type ArchiveWarehouseInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveWarehouseUseCase {
  constructor(private repository: WarehouseRepository) {}

  async handle(input: ArchiveWarehouseInput) {
    const result = await this.repository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new WarehouseNotFoundException()
    }

    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new WarehouseAlreadyArchivedException()
    }

    if (result.kind === 'IN_USE') {
      throw new WarehouseInUseException()
    }

    return { warehouse: result.warehouse, archivedDoorCount: result.archivedDoorCount }
  }
}
