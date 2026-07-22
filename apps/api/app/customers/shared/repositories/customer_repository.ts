import type Customer from '#models/customer'
import type { CustomerStatus } from '#models/customer'

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

export type CustomerWriteResult =
  | { kind: 'CREATED'; customer: Customer }
  | { kind: 'UPDATED'; customer: Customer }
  | { kind: 'DUPLICATE_CODE' }
  | { kind: 'DUPLICATE_COMPANY_NAME' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }

export default abstract class CustomerRepository {
  abstract create(command: CreateCustomerCommand): Promise<CustomerWriteResult>
  abstract list(): Promise<Customer[]>
  abstract listAvailable(): Promise<Customer[]>
  abstract findById(id: string): Promise<Customer | null>
  abstract updateAvailable(command: UpdateCustomerCommand): Promise<CustomerWriteResult>
}
