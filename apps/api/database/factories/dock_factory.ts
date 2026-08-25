import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Dock from '#models/dock'

export const DockFactory = factory
  .define(Dock, ({ faker }) => ({
    // Suffixed to avoid the case-insensitive unique name index colliding across the
    // finite faker.location.city() pool once enough docks are created in a run.
    name: `${faker.location.city()} Dock ${faker.string.alphanumeric({ length: 6 })}`,
    latitude: faker.location.latitude({ max: 90, min: -90 }),
    longitude: faker.location.longitude({ max: 180, min: -180 }),
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (dock) => {
    dock.status = 'ARCHIVED'
    dock.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (dock) => {
    dock.status = 'AVAILABLE'
    dock.archivedAt ??= DateTime.now().minus({ days: 30 })
    dock.reactivatedAt ??= DateTime.now()
  })
  .build()
