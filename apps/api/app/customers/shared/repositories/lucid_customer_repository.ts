import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import {
  findBulkBlockers,
  indexCustomersById,
  orderCustomers,
} from '#customers/shared/customer_lifecycle_blockers'
import Customer from '#models/customer'
import isUniqueViolation from '#shared/database/is_unique_violation'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

import CustomerRepository, {
  type ArchiveCustomerCommand,
  type ArchiveCustomerResult,
  type ArchiveCustomersCommand,
  type BulkCustomerLifecycleResult,
  type CreateCustomerCommand,
  type CustomerWriteResult,
  type ReactivateCustomerCommand,
  type ReactivateCustomerResult,
  type ReactivateCustomersCommand,
  type UpdateCustomerCommand,
} from './customer_repository.ts'

const duplicateKind = (error: unknown): CustomerWriteResult | null => {
  const candidate = error as { constraint?: string; message?: string }
  const message = String(candidate.message ?? '')
  const constraint = String(candidate.constraint ?? '')

  if (
    constraint.includes('customers_company_name_unique') ||
    message.includes('customers_company_name_unique')
  ) {
    return { kind: 'DUPLICATE_COMPANY_NAME' }
  }

  if (constraint.includes('customers_code_unique') || message.includes('customers_code_unique')) {
    return { kind: 'DUPLICATE_CODE' }
  }

  return null
}

@inject()
export default class LucidCustomerRepository extends CustomerRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

  async create(command: CreateCustomerCommand): Promise<CustomerWriteResult> {
    try {
      const customer = await Customer.create({ ...command, status: command.status ?? 'AVAILABLE' })

      return { kind: 'CREATED', customer }
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicate = duplicateKind(error)
        if (duplicate) {
          return duplicate
        }
      }

      throw error
    }
  }

  list(): Promise<Customer[]> {
    return Customer.query().preload('archivedBy').preload('reactivatedBy').orderBy('code', 'asc')
  }

  listAvailable(): Promise<Customer[]> {
    return Customer.query().where('status', 'AVAILABLE').orderBy('code', 'asc')
  }

  findById(id: string): Promise<Customer | null> {
    return Customer.query().where('id', id).preload('archivedBy').preload('reactivatedBy').first()
  }

  findManyByIds(ids: string[]): Promise<Customer[]> {
    return Customer.query().whereIn('id', ids)
  }

  async updateAvailable(command: UpdateCustomerCommand): Promise<CustomerWriteResult> {
    const values = {
      ...(command.code === undefined ? {} : { code: command.code }),
      ...(command.companyName === undefined ? {} : { companyName: command.companyName }),
      updatedAt: DateTime.now().toISO(),
    }

    try {
      const [affectedRows] = await Customer.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update(values)

      if (affectedRows === 0) {
        const customer = await Customer.find(command.id)

        if (!customer) {
          return { kind: 'NOT_FOUND' }
        }
        if (customer.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }

        return { kind: 'NOT_FOUND' }
      }

      const customer = await Customer.find(command.id)
      if (!customer) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'UPDATED', customer }
    } catch (error) {
      if (isUniqueViolation(error)) {
        const duplicate = duplicateKind(error)
        if (duplicate) {
          return duplicate
        }
      }

      throw error
    }
  }

  async archiveAvailable(command: ArchiveCustomerCommand): Promise<ArchiveCustomerResult> {
    const [affectedRows] = await Customer.query()
      .where('id', command.id)
      .where('status', 'AVAILABLE')
      .update({
        status: 'ARCHIVED',
        archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
        archivedByUserId: command.archivedByUserId,
        archiveComment: command.archiveComment,
        updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
      })

    if (affectedRows === 0) {
      const customer = await Customer.find(command.id)

      if (!customer) {
        return { kind: 'NOT_FOUND' }
      }

      return customer.status === 'ARCHIVED' ? { kind: 'ALREADY_ARCHIVED' } : { kind: 'NOT_FOUND' }
    }

    const customer = await Customer.find(command.id)
    if (!customer) {
      return { kind: 'NOT_FOUND' }
    }

    return { kind: 'ARCHIVED', customer }
  }

  async reactivateArchived(command: ReactivateCustomerCommand): Promise<ReactivateCustomerResult> {
    const [affectedRows] = await Customer.query()
      .where('id', command.id)
      .where('status', 'ARCHIVED')
      .update({
        status: 'AVAILABLE',
        reactivatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
        reactivatedByUserId: command.reactivatedByUserId,
        reactivationComment: command.reactivationComment,
        updatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
      })

    if (affectedRows === 0) {
      const customer = await Customer.find(command.id)

      if (!customer) {
        return { kind: 'NOT_FOUND' }
      }

      return customer.status === 'AVAILABLE' ? { kind: 'ALREADY_AVAILABLE' } : { kind: 'NOT_FOUND' }
    }

    const customer = await Customer.find(command.id)
    if (!customer) {
      return { kind: 'NOT_FOUND' }
    }

    return { kind: 'REACTIVATED', customer }
  }

  archiveAvailableMany(command: ArchiveCustomersCommand): Promise<BulkCustomerLifecycleResult> {
    return Customer.transaction(async (trx) => {
      const customers = await Customer.query({ client: trx }).whereIn('id', command.ids).forUpdate()
      const customersById = indexCustomersById(customers)
      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'CUSTOMER',
        referenceIds: command.ids,
      })
      const blockers = findBulkBlockers(command.ids, customersById, 'AVAILABLE', usedIds)

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await Customer.query({ client: trx })
        .whereIn('id', eligibleIds)
        .where('status', 'AVAILABLE')
        .update({
          status: 'ARCHIVED',
          archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
          archivedByUserId: command.archivedByUserId,
          archiveComment: command.archiveComment,
          updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
        })

      if (affectedRows !== eligibleIds.length) {
        throw new Error('Customer bulk archive changed during transaction')
      }

      const archived = await Customer.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedCustomers: orderCustomers(eligibleIds, indexCustomersById(archived)),
        blockedCustomers: blockers,
      }
    })
  }

  reactivateArchivedMany(
    command: ReactivateCustomersCommand,
  ): Promise<BulkCustomerLifecycleResult> {
    return Customer.transaction(async (trx) => {
      const customers = await Customer.query({ client: trx }).whereIn('id', command.ids).forUpdate()
      const customersById = indexCustomersById(customers)
      const blockers = findBulkBlockers(command.ids, customersById, 'ARCHIVED')
      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await Customer.query({ client: trx })
        .whereIn('id', eligibleIds)
        .where('status', 'ARCHIVED')
        .update({
          status: 'AVAILABLE',
          reactivatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
          reactivatedByUserId: command.reactivatedByUserId,
          reactivationComment: command.reactivationComment,
          updatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
        })

      if (affectedRows !== eligibleIds.length) {
        throw new Error('Customer bulk reactivation changed during transaction')
      }

      const reactivated = await Customer.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedCustomers: orderCustomers(eligibleIds, indexCustomersById(reactivated)),
        blockedCustomers: blockers,
      }
    })
  }
}
