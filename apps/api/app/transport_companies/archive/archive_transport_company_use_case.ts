import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  TransportCompanyAlreadyArchivedException,
  TransportCompanyHasAvailableTrucksException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'
import TruckRepository from '#trucks/shared/repositories/truck_repository'

export type ArchiveTransportCompanyInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveTransportCompanyUseCase {
  constructor(
    private transportCompanyRepository: TransportCompanyRepository,
    private truckRepository: TruckRepository,
  ) {}

  async handle(input: ArchiveTransportCompanyInput) {
    const company = await this.transportCompanyRepository.findById(input.id)

    if (!company) {
      throw new TransportCompanyNotFoundException()
    }
    if (company.status === 'ARCHIVED') {
      throw new TransportCompanyAlreadyArchivedException()
    }

    const idsWithAvailableTrucks = await this.truckRepository.findCompanyIdsWithAvailableTrucks({
      transportCompanyIds: [input.id],
    })

    if (idsWithAvailableTrucks.has(input.id)) {
      throw new TransportCompanyHasAvailableTrucksException()
    }

    const result = await this.transportCompanyRepository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TransportCompanyNotFoundException()
    }
    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new TransportCompanyAlreadyArchivedException()
    }
    return result.company
  }
}
