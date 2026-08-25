import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompanyRepository, {
  type BulkTransportCompanyLifecycleResult,
} from '#transport_companies/shared/repositories/transport_company_repository'

export type ReactivateTransportCompaniesInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateTransportCompaniesUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  handle(input: ReactivateTransportCompaniesInput): Promise<BulkTransportCompanyLifecycleResult> {
    return this.transportCompanyRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
