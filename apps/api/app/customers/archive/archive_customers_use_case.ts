import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { BulkCustomerArchiveBlockedException } from '#customers/shared/customer_exceptions'
import { findBulkBlockers, indexCustomersById } from '#customers/shared/customer_lifecycle_blockers'
import CustomerRepository, {
  type BulkCustomerLifecycleBlocker,
} from '#customers/shared/repositories/customer_repository'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

export type ArchiveCustomersInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveCustomersUseCase {
  constructor(
    private customerRepository: CustomerRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: ArchiveCustomersInput) {
    const [customers, usedIds] = await Promise.all([
      this.customerRepository.findManyByIds(input.ids),
      this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'CUSTOMER',
        referenceIds: input.ids,
      }),
    ])
    const customersById = indexCustomersById(customers)
    const blockers = findBulkBlockers(input.ids, customersById, 'AVAILABLE')

    blockers.push(
      ...input.ids.flatMap((id): BulkCustomerLifecycleBlocker[] => {
        const customer = customersById.get(id)

        if (!customer || !usedIds.has(id) || customer.status === 'ARCHIVED') {
          return []
        }

        return [
          {
            id,
            code: customer.code,
            companyName: customer.companyName,
            reason: 'IN_USE',
          },
        ]
      }),
    )

    if (blockers.length > 0) {
      throw new BulkCustomerArchiveBlockedException(blockers)
    }

    const result = await this.customerRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'BLOCKED') {
      throw new BulkCustomerArchiveBlockedException(result.blockers)
    }

    return result.customers
  }
}
