import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository, {
  type BulkTruckLifecycleResult,
} from '#trucks/shared/repositories/truck_repository'

export type ArchiveTrucksInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveTrucksUseCase {
  constructor(private truckRepository: TruckRepository) {}

  handle(input: ArchiveTrucksInput): Promise<BulkTruckLifecycleResult> {
    return this.truckRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
