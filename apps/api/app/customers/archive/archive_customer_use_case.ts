import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import {
  CustomerAlreadyArchivedException,
  CustomerInUseException,
  CustomerNotFoundException,
} from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

export type ArchiveCustomerInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(input: ArchiveCustomerInput) {
    const customer = await this.customerRepository.findById(input.id)

    if (!customer) {
      throw new CustomerNotFoundException()
    }
    if (customer.status === 'ARCHIVED') {
      throw new CustomerAlreadyArchivedException()
    }

    const result = await this.customerRepository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new CustomerNotFoundException()
    }
    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new CustomerAlreadyArchivedException()
    }
    // Decided by the repository under the customer's lock, never from a usage read beforehand.
    if (result.kind === 'IN_USE') {
      throw new CustomerInUseException()
    }

    return result.customer
  }
}
