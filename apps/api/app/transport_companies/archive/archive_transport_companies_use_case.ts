import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompanyRepository, {
  type BulkTransportCompanyLifecycleResult,
} from '#transport_companies/shared/repositories/transport_company_repository'

export type ArchiveTransportCompaniesInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveTransportCompaniesUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  handle(input: ArchiveTransportCompaniesInput): Promise<BulkTransportCompanyLifecycleResult> {
    return this.transportCompanyRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
