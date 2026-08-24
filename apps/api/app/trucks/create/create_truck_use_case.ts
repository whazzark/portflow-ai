import { inject } from '@adonisjs/core'

import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'
import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  DuplicateTruckRegistrationException,
  InvalidTransportCompanyException,
} from '#trucks/shared/truck_exceptions'

export type CreateTruckInput = {
  registration: string
  vehicleModel: string | null
  capacityTonnes: number
  transportCompanyId: string
}

@inject()
export default class CreateTruckUseCase {
  constructor(private truckRepository: TruckRepository) {}

  async handle(input: CreateTruckInput) {
    const registration = assertValidSiteReferenceName(input.registration)
    const vehicleModel =
      input.vehicleModel === null ? null : assertValidSiteReferenceName(input.vehicleModel)

    const result = await this.truckRepository.create({
      registration,
      vehicleModel,
      capacityTonnes: input.capacityTonnes,
      transportCompanyId: input.transportCompanyId,
    })

    if (result.kind === 'DUPLICATE_REGISTRATION') {
      throw new DuplicateTruckRegistrationException()
    }
    if (result.kind === 'INVALID_TRANSPORT_COMPANY') {
      throw new InvalidTransportCompanyException()
    }

    if (result.kind !== 'CREATED') {
      throw new Error(`Unexpected truck creation result: ${result.kind}`)
    }

    return result.truck
  }
}
