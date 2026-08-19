import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Customer from '#models/customer'

export const CustomerFactory = factory
  .define(Customer, ({ faker }) => ({
    code: faker.string.alphanumeric({ length: 8 }).toUpperCase(),
    companyName: `${faker.company.name()} ${faker.string.alphanumeric({ length: 6 })}`,
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (customer) => {
    customer.status = 'ARCHIVED'
    customer.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (customer) => {
    customer.status = 'AVAILABLE'
    customer.archivedAt ??= DateTime.now().minus({ days: 30 })
    customer.reactivatedAt ??= DateTime.now()
  })
  .build()
