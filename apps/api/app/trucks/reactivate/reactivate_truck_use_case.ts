import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  TruckAlreadyAvailableException,
  TruckNotFoundException,
  TruckTransportCompanyArchivedException,
} from '#trucks/shared/truck_exceptions'

export type ReactivateTruckInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateTruckUseCase {
  constructor(private truckRepository: TruckRepository) {}

  async handle(input: ReactivateTruckInput) {
    const result = await this.truckRepository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TruckNotFoundException()
    }
    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new TruckAlreadyAvailableException()
    }
    if (result.kind === 'TRANSPORT_COMPANY_ARCHIVED') {
      throw new TruckTransportCompanyArchivedException()
    }
    return result.truck
  }
}
