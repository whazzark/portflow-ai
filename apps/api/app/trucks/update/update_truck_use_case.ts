import { inject } from '@adonisjs/core'

import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import TruckRepository from '#trucks/shared/repositories/truck_repository'
import {
  ArchivedTruckReadOnlyException,
  DuplicateTruckRegistrationException,
  InvalidTransportCompanyException,
  SuspendedTruckReadOnlyException,
  TruckNotFoundException,
  TruckTransportCompanyLockedException,
} from '#trucks/shared/truck_exceptions'

export type UpdateTruckInput = {
  id: string
  registration: string
  vehicleModel: string | null
  capacityTonnes: number
  transportCompanyId: string
}

/**
 * Bounds the compare-and-swap retry below. Each retry only happens when another request changes
 * this truck's transport company in the narrow window between our read and our write, so a real
 * run exhausting this is not expected; it exists to turn a pathological contention storm into a
 * clear error instead of a silent infinite loop.
 */
const MAX_REASSIGNMENT_ATTEMPTS = 5

@inject()
export default class UpdateTruckUseCase {
  constructor(
    private truckRepository: TruckRepository,
    private transportCompanyRepository: TransportCompanyRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: UpdateTruckInput) {
    const registration = assertValidSiteReferenceName(input.registration)
    const vehicleModel =
      input.vehicleModel === null ? null : assertValidSiteReferenceName(input.vehicleModel)

    for (let attempt = 0; attempt < MAX_REASSIGNMENT_ATTEMPTS; attempt += 1) {
      const truck = await this.truckRepository.findById(input.id)

      if (!truck) {
        throw new TruckNotFoundException()
      }

      if (truck.status === 'SUSPENDED') {
        throw new SuspendedTruckReadOnlyException()
      }
      if (truck.status === 'ARCHIVED') {
        throw new ArchivedTruckReadOnlyException()
      }

      const currentTransportCompanyId = truck.transportCompanyId
      const isReassigning = input.transportCompanyId !== currentTransportCompanyId

      if (isReassigning) {
        const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
          referenceType: 'TRUCK',
          referenceIds: [input.id],
        })

        if (usedIds.has(input.id)) {
          throw new TruckTransportCompanyLockedException()
        }

        const transportCompany = await this.transportCompanyRepository.findById(
          input.transportCompanyId,
        )
        if (transportCompany?.status !== 'AVAILABLE') {
          throw new InvalidTransportCompanyException()
        }
      }

      const result = await this.truckRepository.updateAvailable({
        id: input.id,
        registration,
        vehicleModel,
        capacityTonnes: input.capacityTonnes,
        transportCompanyId: input.transportCompanyId,
        expectedTransportCompanyId: currentTransportCompanyId,
      })

      if (result.kind === 'TRANSPORT_COMPANY_CHANGED') {
        // Another request reassigned this truck between our read and our write: the decision
        // above was validated against a value that is no longer current. Re-read and redecide
        // rather than either applying our stale decision or overwriting the concurrent change.
        continue
      }
      if (result.kind === 'NOT_FOUND') {
        throw new TruckNotFoundException()
      }
      if (result.kind === 'SUSPENDED') {
        throw new SuspendedTruckReadOnlyException()
      }
      if (result.kind === 'ARCHIVED') {
        throw new ArchivedTruckReadOnlyException()
      }
      if (result.kind === 'DUPLICATE_REGISTRATION') {
        throw new DuplicateTruckRegistrationException()
      }
      if (result.kind !== 'UPDATED') {
        throw new Error(`Unexpected truck update result: ${result.kind}`)
      }

      return result.truck
    }

    throw new Error(
      `Truck ${input.id} transport company kept changing concurrently; giving up after ${MAX_REASSIGNMENT_ATTEMPTS} attempts`,
    )
  }
}
