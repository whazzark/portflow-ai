import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CustomerRepository, {
  type BulkCustomerLifecycleResult,
} from '#customers/shared/repositories/customer_repository'

export type ReactivateCustomersInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateCustomersUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  handle(input: ReactivateCustomersInput): Promise<BulkCustomerLifecycleResult> {
    return this.customerRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
