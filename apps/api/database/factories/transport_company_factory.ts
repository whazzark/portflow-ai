import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'

export const TransportCompanyFactory = factory
  .define(TransportCompany, ({ faker }) => ({
    name: faker.company.name(),
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (company) => {
    company.status = 'ARCHIVED'
    company.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (company) => {
    company.status = 'AVAILABLE'
    company.archivedAt ??= DateTime.now().minus({ days: 30 })
    company.reactivatedAt ??= DateTime.now()
  })
  .build()
