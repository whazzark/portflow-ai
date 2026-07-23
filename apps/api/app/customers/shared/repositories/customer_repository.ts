import type { DateTime } from 'luxon'
import type { BulkCustomerLifecycleBlocker } from '#customers/shared/customer_lifecycle_blockers'
import type Customer from '#models/customer'
import type { CustomerStatus } from '#models/customer'

export type { BulkCustomerLifecycleBlocker } from '#customers/shared/customer_lifecycle_blockers'

export type CreateCustomerCommand = {
  code: string
  companyName: string
  status?: CustomerStatus
}

export type UpdateCustomerCommand = {
  id: string
  code?: string
  companyName?: string
}

export type ArchiveCustomerCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ReactivateCustomerCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ArchiveCustomersCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ReactivateCustomersCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type BulkCustomerLifecycleResult =
  | { kind: 'ARCHIVED' | 'REACTIVATED'; customers: Customer[] }
  | { kind: 'BLOCKED'; blockers: BulkCustomerLifecycleBlocker[] }

export type CustomerWriteResult =
  | { kind: 'CREATED'; customer: Customer }
  | { kind: 'UPDATED'; customer: Customer }
  | { kind: 'DUPLICATE_CODE' }
  | { kind: 'DUPLICATE_COMPANY_NAME' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }

export type ArchiveCustomerResult =
  | { kind: 'ARCHIVED'; customer: Customer }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }

export type ReactivateCustomerResult =
  | { kind: 'REACTIVATED'; customer: Customer }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

export default abstract class CustomerRepository {
  abstract create(command: CreateCustomerCommand): Promise<CustomerWriteResult>
  abstract list(): Promise<Customer[]>
  abstract listAvailable(): Promise<Customer[]>
  abstract findById(id: string): Promise<Customer | null>
  abstract findManyByIds(ids: string[]): Promise<Customer[]>
  abstract updateAvailable(command: UpdateCustomerCommand): Promise<CustomerWriteResult>
  abstract archiveAvailable(command: ArchiveCustomerCommand): Promise<ArchiveCustomerResult>
  abstract reactivateArchived(command: ReactivateCustomerCommand): Promise<ReactivateCustomerResult>
  abstract archiveAvailableMany(
    command: ArchiveCustomersCommand,
  ): Promise<BulkCustomerLifecycleResult>
  abstract reactivateArchivedMany(
    command: ReactivateCustomersCommand,
  ): Promise<BulkCustomerLifecycleResult>
}
