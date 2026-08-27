import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseDoorRepository, {
  type BulkWarehouseDoorLifecycleResult,
} from '#warehouse_doors/shared/repositories/warehouse_door_repository'

export type ArchiveWarehouseDoorsInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveWarehouseDoorsUseCase {
  constructor(private repository: WarehouseDoorRepository) {}

  handle(input: ArchiveWarehouseDoorsInput): Promise<BulkWarehouseDoorLifecycleResult> {
    return this.repository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
