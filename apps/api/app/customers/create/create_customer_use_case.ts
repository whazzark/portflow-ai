import { inject } from '@adonisjs/core'

import {
  DuplicateCustomerCodeException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import { normalizeCompanyName, normalizeCustomerCode } from '#customers/shared/normalize_customer'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

export type CreateCustomerInput = {
  code: string
  companyName: string
}

@inject()
export default class CreateCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: CreateCustomerInput) {
    const result = await this.customerRepository.create({
      code: normalizeCustomerCode(input.code),
      companyName: normalizeCompanyName(input.companyName),
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
