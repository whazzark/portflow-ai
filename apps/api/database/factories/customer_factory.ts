import factory from '@adonisjs/lucid/factories'

import Customer from '#models/customer'

export const CustomerFactory = factory
  .define(Customer, ({ faker }) => ({
    code: faker.string.alphanumeric({ length: 8 }).toUpperCase(),
    companyName: faker.company.name(),
    status: 'AVAILABLE' as const,
  }))
  .state('archived', (customer) => {
    customer.status = 'ARCHIVED'
  })
  .build()
