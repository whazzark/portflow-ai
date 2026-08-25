import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  TransportCompanyAlreadyAvailableException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'

export type ReactivateTransportCompanyInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateTransportCompanyUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  async handle(input: ReactivateTransportCompanyInput) {
    const result = await this.transportCompanyRepository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TransportCompanyNotFoundException()
    }
    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new TransportCompanyAlreadyAvailableException()
    }
    return result.company
  }
}
