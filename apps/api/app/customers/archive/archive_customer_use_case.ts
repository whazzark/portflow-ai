import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import {
  CustomerAlreadyArchivedException,
  CustomerInUseException,
  CustomerNotFoundException,
} from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

export type ArchiveCustomerInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveCustomerUseCase {
  constructor(
    private customerRepository: CustomerRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: ArchiveCustomerInput) {
    const customer = await this.customerRepository.findById(input.id)

    if (!customer) {
      throw new CustomerNotFoundException()
    }
    if (customer.status === 'ARCHIVED') {
      throw new CustomerAlreadyArchivedException()
    }

    const isInUse = await this.usageChecker.isUsedByPlannedOrActiveDischarge({
      referenceType: 'CUSTOMER',
      referenceId: input.id,
    })

    if (isInUse) {
      throw new CustomerInUseException()
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
    if (result.kind !== 'UPDATED') {
      throw new Error(`Unexpected customer archival result: ${result.kind}`)
    }

    return result.customer
  }
}
