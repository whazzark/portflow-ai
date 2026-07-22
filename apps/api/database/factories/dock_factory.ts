import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import Dock from '#models/dock'

export const DockFactory = factory
  .define(Dock, ({ faker }) => ({
    name: `${faker.location.city()} Dock`,
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
    dock.archivedAt = DateTime.now()
    dock.archivedByUserId = null
    dock.archiveComment = null
    dock.reactivatedAt = null
    dock.reactivatedByUserId = null
    dock.reactivationComment = null
  })
  .state('reactivated', (dock) => {
    dock.status = 'AVAILABLE'
    dock.archivedAt = null
    dock.archivedByUserId = null
    dock.archiveComment = null
    dock.reactivatedAt = DateTime.now()
    dock.reactivatedByUserId = null
    dock.reactivationComment = null
  })
  .build()
