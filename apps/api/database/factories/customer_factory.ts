import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Customer from '#models/customer'

export const CustomerFactory = factory
  .define(Customer, ({ faker }) => ({
    code: faker.string.alphanumeric({ length: 8 }).toUpperCase(),
    companyName: faker.company.name(),
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
    customer.archivedAt = DateTime.now()
    customer.archivedByUserId = null
    customer.archiveComment = null
    customer.reactivatedAt = null
    customer.reactivatedByUserId = null
    customer.reactivationComment = null
  })
  .state('reactivated', (customer) => {
    customer.status = 'AVAILABLE'
    customer.archivedAt = null
    customer.archivedByUserId = null
    customer.archiveComment = null
    customer.reactivatedAt = DateTime.now()
    customer.reactivatedByUserId = null
    customer.reactivationComment = null
  })
  .build()
