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
    company.archivedAt = DateTime.now()
    company.archivedByUserId = null
    company.archiveComment = null
    company.reactivatedAt = null
    company.reactivatedByUserId = null
    company.reactivationComment = null
  })
  .state('reactivated', (company) => {
    company.status = 'AVAILABLE'
    company.archivedAt = DateTime.now().minus({ days: 30 })
    company.archivedByUserId = null
    company.archiveComment = null
    company.reactivatedAt = DateTime.now()
    company.reactivatedByUserId = null
    company.reactivationComment = null
  })
  .build()
