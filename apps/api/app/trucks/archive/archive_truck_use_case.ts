import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  TruckAlreadyArchivedException,
  TruckInUseException,
  TruckNotFoundException,
} from '#trucks/shared/truck_exceptions'

export type ArchiveTruckInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveTruckUseCase {
  constructor(
    private truckRepository: TruckRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: ArchiveTruckInput) {
    const truck = await this.truckRepository.findById(input.id)

    if (!truck) {
      throw new TruckNotFoundException()
    }
    if (truck.status === 'ARCHIVED') {
      throw new TruckAlreadyArchivedException()
    }

    const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
      referenceType: 'TRUCK',
      referenceIds: [input.id],
    })

    if (usedIds.has(input.id)) {
      throw new TruckInUseException()
    }

    const result = await this.truckRepository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TruckNotFoundException()
    }
    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new TruckAlreadyArchivedException()
    }
    return result.truck
  }
}
