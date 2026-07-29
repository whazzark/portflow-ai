import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
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
  constructor(
    private repository: WeighingAreaRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: ArchiveWeighingAreaInput) {
    const area = await this.repository.findById(input.id)

    if (!area) {
      throw new WeighingAreaNotFoundException()
    }

    if (area.status === 'ARCHIVED') {
      throw new WeighingAreaAlreadyArchivedException()
    }

    if (
      (
        await this.usageChecker.findUsedByPlannedOrActiveDischarge({
          referenceType: 'WEIGHING_AREA',
          referenceIds: [input.id],
        })
      ).has(input.id)
    ) {
      throw new WeighingAreaInUseException()
    }

    const result = await this.repository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new WeighingAreaNotFoundException()
    }

    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new WeighingAreaAlreadyArchivedException()
    }

    return result.weighingArea
  }
}
