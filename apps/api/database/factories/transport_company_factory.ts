import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'

export const TransportCompanyFactory = factory
  .define(TransportCompany, ({ faker }) => ({
    // Suffixed to avoid the case-insensitive unique name index colliding across the
    // finite faker.company.name() pool once enough companies are created in a run.
    name: `${faker.company.name()} ${faker.string.alphanumeric({ length: 6 })}`,
    // A deliberately generated format rather than the locale-dependent faker.phone.number():
    // that can emit extensions or letters that the accepted phone format would reject.
    contactPhone: `+33${faker.string.numeric({ length: 9 })}`,
    contactEmail: faker.internet.email(),
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
  .state('withoutContact', (company) => {
    company.contactPhone = null
    company.contactEmail = null
  })
  .build()
