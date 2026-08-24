import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  TransportCompanyAlreadyArchivedException,
  TransportCompanyHasAvailableTrucksException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'

export type ArchiveTransportCompanyInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveTransportCompanyUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  async handle(input: ArchiveTransportCompanyInput) {
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
    if (result.kind === 'HAS_AVAILABLE_TRUCKS') {
      throw new TransportCompanyHasAvailableTrucksException()
    }
    return result.company
  }
}
