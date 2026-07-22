import { inject } from '@adonisjs/core'

import { CustomerNotFoundException } from '#customers/shared/customer_exceptions'
import CustomerRepository from '#customers/shared/repositories/customer_repository'

@inject()
export default class GetCustomerUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  async handle(id: string) {
    const customer = await this.customerRepository.findById(id)

    if (!customer) {
      throw new CustomerNotFoundException()
    }

    return customer
  }
}
