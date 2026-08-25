import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  SuspendedTruckReadOnlyException,
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
  constructor(private truckRepository: TruckRepository) {}

  async handle(input: ArchiveTruckInput) {
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
    if (result.kind === 'IN_USE') {
      throw new TruckInUseException()
    }
    if (result.kind === 'SUSPENDED') {
      throw new SuspendedTruckReadOnlyException()
    }
    return result.truck
  }
}
