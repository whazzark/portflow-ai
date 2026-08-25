import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  TruckAlreadyAvailableException,
  TruckArchivedCannotReturnException,
  TruckNotFoundException,
  TruckTransportCompanyArchivedException,
} from '#trucks/shared/truck_exceptions'

export type ReturnTruckToServiceInput = {
  id: string
  returnedToServiceByUserId: string
  returnedToServiceAt: DateTime
  comment?: string | null
}

@inject()
export default class ReturnTruckToServiceUseCase {
  constructor(private truckRepository: TruckRepository) {}

  async handle(input: ReturnTruckToServiceInput) {
    const result = await this.truckRepository.returnSuspendedToService({
      id: input.id,
      returnedToServiceAt: input.returnedToServiceAt,
      returnedToServiceByUserId: input.returnedToServiceByUserId,
      returnToServiceComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TruckNotFoundException()
    }
    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new TruckAlreadyAvailableException()
    }
    if (result.kind === 'ARCHIVED') {
      throw new TruckArchivedCannotReturnException()
    }
    if (result.kind === 'TRANSPORT_COMPANY_ARCHIVED') {
      throw new TruckTransportCompanyArchivedException()
    }
    return result.truck
  }
}
