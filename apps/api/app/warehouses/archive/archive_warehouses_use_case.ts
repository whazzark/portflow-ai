import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseRepository, {
  type BulkWarehouseLifecycleResult,
} from '#warehouses/shared/repositories/warehouse_repository'

export type ArchiveWarehousesInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveWarehousesUseCase {
  constructor(private repository: WarehouseRepository) {}

  handle(input: ArchiveWarehousesInput): Promise<BulkWarehouseLifecycleResult> {
    return this.repository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
