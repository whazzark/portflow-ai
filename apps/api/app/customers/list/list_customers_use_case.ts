import { inject } from '@adonisjs/core'

import CustomerRepository from '#customers/shared/repositories/customer_repository'

@inject()
export default class ListCustomersUseCase {
  constructor(private customerRepository: CustomerRepository) {}

  handle() {
    return this.customerRepository.list()
  }
}
