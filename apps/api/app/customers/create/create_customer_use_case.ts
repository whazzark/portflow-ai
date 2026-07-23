import { inject } from '@adonisjs/core'

import {
  DuplicateCustomerCodeException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import { assertValidCustomerCode } from '#customers/shared/normalize_customer'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import { assertValidSiteReferenceName } from '#site_references/shared/normalize_site_reference'

export type CreateCustomerInput = {
  code: string
  companyName: string
}

@inject()
export default class CreateCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: CreateCustomerInput) {
    const result = await this.customerRepository.create({
      code: assertValidCustomerCode(input.code),
      companyName: assertValidSiteReferenceName(input.companyName),
    })

    if (result.kind === 'DUPLICATE_CODE') {
      throw new DuplicateCustomerCodeException()
    }
    if (result.kind === 'DUPLICATE_COMPANY_NAME') {
      throw new DuplicateCustomerCompanyNameException()
    }

    if (result.kind !== 'CREATED') {
      throw new Error(`Unexpected customer creation result: ${result.kind}`)
    }

    return result.customer
  }
}
