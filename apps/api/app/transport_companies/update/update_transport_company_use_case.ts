import { inject } from '@adonisjs/core'

import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'
import {
  assertValidContactEmail,
  assertValidContactPhone,
} from '#transport_companies/shared/normalize_transport_company_contact'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import {
  ArchivedTransportCompanyReadOnlyException,
  DuplicateTransportCompanyNameException,
  TransportCompanyNotFoundException,
} from '#transport_companies/shared/transport_company_exceptions'

export type UpdateTransportCompanyInput = {
  id: string
  name: string
  contactPhone: string
  contactEmail: string
}

@inject()
export default class UpdateTransportCompanyUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  async handle(input: UpdateTransportCompanyInput) {
    const result = await this.transportCompanyRepository.updateAvailable({
      id: input.id,
      name: assertValidSiteReferenceName(input.name),
      contactPhone: assertValidContactPhone(input.contactPhone),
      contactEmail: assertValidContactEmail(input.contactEmail),
    })

    if (result.kind === 'NOT_FOUND') {
      throw new TransportCompanyNotFoundException()
    }
    if (result.kind === 'ARCHIVED') {
      throw new ArchivedTransportCompanyReadOnlyException()
    }
    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateTransportCompanyNameException()
    }

    return result.company
  }
}
