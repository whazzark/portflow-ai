import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import CustomerRepository, {
  type BulkCustomerLifecycleResult,
} from '#customers/shared/repositories/customer_repository'

export type ArchiveCustomersInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveCustomersUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  handle(input: ArchiveCustomersInput): Promise<BulkCustomerLifecycleResult> {
    return this.customerRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
