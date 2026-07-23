import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { BulkCustomerReactivationBlockedException } from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

export type ReactivateCustomersInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateCustomersUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: ReactivateCustomersInput) {
    const result = await this.customerRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'BLOCKED') {
      throw new BulkCustomerReactivationBlockedException(result.blockers)
    }

    return result.customers
  }
}
