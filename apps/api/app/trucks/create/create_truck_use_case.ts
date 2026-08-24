import { inject } from '@adonisjs/core'

import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
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
  constructor(
    private truckRepository: TruckRepository,
    private transportCompanyRepository: TransportCompanyRepository,
  ) {}

  async handle(input: CreateTruckInput) {
    const registration = assertValidSiteReferenceName(input.registration)
    const vehicleModel =
      input.vehicleModel === null ? null : assertValidSiteReferenceName(input.vehicleModel)

    const transportCompany = await this.transportCompanyRepository.findById(
      input.transportCompanyId,
    )
    if (transportCompany?.status !== 'AVAILABLE') {
      throw new InvalidTransportCompanyException()
    }

    const result = await this.truckRepository.create({
      registration,
      vehicleModel,
      capacityTonnes: input.capacityTonnes,
      transportCompanyId: input.transportCompanyId,
    })

    if (result.kind === 'DUPLICATE_REGISTRATION') {
      throw new DuplicateTruckRegistrationException()
    }

    if (result.kind !== 'CREATED') {
      throw new Error(`Unexpected truck creation result: ${result.kind}`)
    }

    return result.truck
  }
}
