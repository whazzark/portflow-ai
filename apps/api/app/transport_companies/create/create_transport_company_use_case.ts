import { inject } from '@adonisjs/core'

import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'
import TransportCompanyRepository from '#transport_companies/shared/repositories/transport_company_repository'
import { DuplicateTransportCompanyNameException } from '#transport_companies/shared/transport_company_exceptions'

export type CreateTransportCompanyInput = {
  name: string
}

@inject()
export default class CreateTransportCompanyUseCase {
  constructor(private transportCompanyRepository: TransportCompanyRepository) {}

  async handle(input: CreateTransportCompanyInput) {
    const result = await this.transportCompanyRepository.create({
      name: assertValidSiteReferenceName(input.name),
    })

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateTransportCompanyNameException()
    }

    if (result.kind !== 'CREATED') {
      throw new Error(`Unexpected transport company creation result: ${result.kind}`)
    }

    return result.company
  }
}
