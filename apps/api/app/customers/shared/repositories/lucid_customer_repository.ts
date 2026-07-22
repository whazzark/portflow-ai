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

  const candidate = error as { code?: string; message?: string }
  return candidate.code === '23505' || candidate.code === 'SQLITE_CONSTRAINT_UNIQUE'
}

const duplicateKind = (error: unknown): CustomerWriteResult => {
  const message = String((error as { message?: string }).message ?? '')

  if (message.includes('company_name')) {
    return { kind: 'DUPLICATE_COMPANY_NAME' }
  }

  return { kind: 'DUPLICATE_CODE' }
}

export default class LucidCustomerRepository extends CustomerRepository {
  async create(command: CreateCustomerCommand): Promise<CustomerWriteResult> {
    const duplicateCode = await Customer.query()
      .whereRaw('LOWER(code) = ?', [command.code.toLowerCase()])
      .first()
    if (duplicateCode) {
      return { kind: 'DUPLICATE_CODE' }
    }

    const duplicateCompanyName = await Customer.query()
      .whereRaw('LOWER(company_name) = ?', [command.companyName.toLowerCase()])
      .first()
    if (duplicateCompanyName) {
      return { kind: 'DUPLICATE_COMPANY_NAME' }
    }

    try {
      const customer = await Customer.create({ ...command, status: command.status ?? 'AVAILABLE' })

      return { kind: 'CREATED', customer }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateKind(error)
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
    const customer = await Customer.find(command.id)

    if (!customer) {
      return { kind: 'NOT_FOUND' }
    }
    if (customer.status !== 'AVAILABLE') {
      return { kind: 'ARCHIVED' }
    }

    if (command.code !== undefined) {
      const duplicateCode = await Customer.query()
        .whereRaw('LOWER(code) = ?', [command.code.toLowerCase()])
        .whereNot('id', command.id)
        .first()
      if (duplicateCode) {
        return { kind: 'DUPLICATE_CODE' }
      }
    }

    if (command.companyName !== undefined) {
      const duplicateCompanyName = await Customer.query()
        .whereRaw('LOWER(company_name) = ?', [command.companyName.toLowerCase()])
        .whereNot('id', command.id)
        .first()
      if (duplicateCompanyName) {
        return { kind: 'DUPLICATE_COMPANY_NAME' }
      }
    }

    customer.merge({
      ...(command.code === undefined ? {} : { code: command.code }),
      ...(command.companyName === undefined ? {} : { companyName: command.companyName }),
    })

    try {
      await customer.save()

      return { kind: 'UPDATED', customer }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return duplicateKind(error)
      }

      throw error
    }
  }
}
