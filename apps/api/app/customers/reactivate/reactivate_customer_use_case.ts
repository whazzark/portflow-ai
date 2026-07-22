import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import {
  CustomerAlreadyAvailableException,
  CustomerNotFoundException,
} from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

export type ReactivateCustomerInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: ReactivateCustomerInput) {
    const customer = await this.customerRepository.findById(input.id)

    if (!customer) {
      throw new CustomerNotFoundException()
    }
    if (customer.status === 'AVAILABLE') {
      throw new CustomerAlreadyAvailableException()
    }

    const result = await this.customerRepository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new CustomerNotFoundException()
    }
    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new CustomerAlreadyAvailableException()
    }
    return result.customer
  }
}
