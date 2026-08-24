import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'

export const TransportCompanyFactory = factory
  .define(TransportCompany, ({ faker }) => ({
    // Suffixed to avoid the case-insensitive unique name index colliding across the
    // finite faker.company.name() pool once enough companies are created in a run.
    name: `${faker.company.name()} ${faker.string.alphanumeric({ length: 6 })}`,
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
