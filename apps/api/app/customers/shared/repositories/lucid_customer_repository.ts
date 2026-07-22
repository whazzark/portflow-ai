import { DateTime } from 'luxon'

import Customer from '#models/customer'

import CustomerRepository, {
  type CreateCustomerCommand,
  type CustomerWriteResult,
  type UpdateCustomerCommand,
} from './customer_repository.ts'

const isUniqueViolation = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; constraint?: string; message?: string }
  return candidate.code === '23505' || candidate.code === 'SQLITE_CONSTRAINT_UNIQUE'
}

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
}
