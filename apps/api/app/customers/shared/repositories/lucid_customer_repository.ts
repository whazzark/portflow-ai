import { DateTime } from 'luxon'

import Customer from '#models/customer'
import isUniqueViolation from '#shared/database/is_unique_violation'

import CustomerRepository, {
  type ArchiveCustomerCommand,
  type ArchiveCustomerResult,
  type CreateCustomerCommand,
  type CustomerWriteResult,
  type ReactivateCustomerCommand,
  type ReactivateCustomerResult,
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

export default class LucidCustomerRepository extends CustomerRepository {
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
    return Customer.query().orderBy('code', 'asc')
  }

  listAvailable(): Promise<Customer[]> {
    return Customer.query().where('status', 'AVAILABLE').orderBy('code', 'asc')
  }

  findById(id: string): Promise<Customer | null> {
    return Customer.find(id)
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
}
