import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  WarehouseDoorAlreadyArchivedException,
  WarehouseDoorInUseException,
  WarehouseDoorNotFoundException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import {
  ArchivedWarehouseReadOnlyException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

export type ArchiveWarehouseDoorInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

/**
 * Unlike `ArchiveDockUseCase`, this one holds no pre-check: existence, lifecycle, and usage are all
 * decided inside the repository's write transaction. A dock has no cascading parent, so a lost race
 * merely fails to archive it; a door's lost race would let #210's warehouse cascade and this write
 * both archive the same door, the second overwriting the time, actor, comment, and provenance a
 * later warehouse reactivation depends on.
 */
@inject()
export default class ArchiveWarehouseDoorUseCase {
  constructor(private repository: WarehouseDoorRepository) {}

  async handle(input: ArchiveWarehouseDoorInput) {
    const result = await this.repository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    switch (result.kind) {
      case 'ARCHIVED':
        return result.door
      case 'DOOR_NOT_FOUND':
        throw new WarehouseDoorNotFoundException()
      case 'ALREADY_ARCHIVED':
        throw new WarehouseDoorAlreadyArchivedException()
      case 'IN_USE':
        throw new WarehouseDoorInUseException()
      case 'WAREHOUSE_NOT_FOUND':
        throw new WarehouseNotFoundException()
      case 'WAREHOUSE_ARCHIVED':
        throw new ArchivedWarehouseReadOnlyException()
    }
  }
}
