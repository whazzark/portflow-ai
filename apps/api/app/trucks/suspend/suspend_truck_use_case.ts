import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  TruckAlreadySuspendedException,
  TruckArchivedCannotSuspendException,
  TruckNotFoundException,
} from '#trucks/shared/truck_exceptions'

export type SuspendTruckInput = {
  id: string
  suspendedByUserId: string
  suspendedAt: DateTime
  comment?: string | null
}

@inject()
export default class SuspendTruckUseCase {
  constructor(private truckRepository: TruckRepository) {}

  async handle(input: SuspendTruckInput) {
    const result = await this.truckRepository.suspendAvailable({
      id: input.id,
      suspendedAt: input.suspendedAt,
      suspendedByUserId: input.suspendedByUserId,
      suspensionComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TruckNotFoundException()
    }
    if (result.kind === 'ALREADY_SUSPENDED') {
      throw new TruckAlreadySuspendedException()
    }
    if (result.kind === 'ARCHIVED') {
      throw new TruckArchivedCannotSuspendException()
    }
    return result.truck
  }
}
