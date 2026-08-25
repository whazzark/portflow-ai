import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import WeighingAreaRepository, {
  type BulkWeighingAreaLifecycleResult,
} from '#weighing_areas/shared/repositories/weighing_area_repository'

export type ArchiveWeighingAreasInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveWeighingAreasUseCase {
  constructor(private weighingAreaRepository: WeighingAreaRepository) {}

  handle(input: ArchiveWeighingAreasInput): Promise<BulkWeighingAreaLifecycleResult> {
    return this.weighingAreaRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
