import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'
import {
  WeighingAreaAlreadyArchivedException,
  WeighingAreaInUseException,
  WeighingAreaNotFoundException,
} from '#weighing_areas/shared/weighing_area_exceptions'

export type ArchiveWeighingAreaInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveWeighingAreaUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  async handle(input: ArchiveWeighingAreaInput) {
    const result = await this.repository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    switch (result.kind) {
      case 'ARCHIVED':
        return result.weighingArea
      case 'NOT_FOUND':
        throw new WeighingAreaNotFoundException()
      case 'ALREADY_ARCHIVED':
        throw new WeighingAreaAlreadyArchivedException()
      // Decided by the repository under the area's lock, never from a usage read beforehand.
      case 'IN_USE':
        throw new WeighingAreaInUseException()
    }
  }
}
