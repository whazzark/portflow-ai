import { inject } from '@adonisjs/core'

import {
  ArchivedCustomerReadOnlyException,
  CustomerNotFoundException,
  DuplicateCustomerCodeException,
  DuplicateCustomerCompanyNameException,
} from '#customers/shared/customer_exceptions'
import { normalizeCompanyName, normalizeCustomerCode } from '#customers/shared/normalize_customer'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

export type UpdateCustomerInput = {
  id: string
  code?: string
  companyName?: string
}

@inject()
export default class UpdateCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: UpdateCustomerInput) {
    const result = await this.customerRepository.updateAvailable({
      id: input.id,
      ...(input.code === undefined ? {} : { code: normalizeCustomerCode(input.code) }),
      ...(input.companyName === undefined
        ? {}
        : { companyName: normalizeCompanyName(input.companyName) }),
    })

    if (result.kind === 'NOT_FOUND') {
      throw new CustomerNotFoundException()
    }
    if (result.kind === 'ARCHIVED') {
      throw new ArchivedCustomerReadOnlyException()
    }
    if (result.kind === 'DUPLICATE_CODE') {
      throw new DuplicateCustomerCodeException()
    }
    if (result.kind === 'DUPLICATE_COMPANY_NAME') {
      throw new DuplicateCustomerCompanyNameException()
    }

    if (result.kind !== 'UPDATED') {
      throw new Error(`Unexpected customer update result: ${result.kind}`)
    }

    return result.customer
  }
}
