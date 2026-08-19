import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'

import WeighingArea from '#models/weighing_area'

export const WeighingAreaFactory = factory
  .define(WeighingArea, ({ faker }) => ({
    name: `${faker.location.city()} Weighing Area`,
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
  .state('archived', (area) => {
    area.status = 'ARCHIVED'
    area.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (area) => {
    area.status = 'AVAILABLE'
    area.archivedAt ??= DateTime.now().minus({ days: 30 })
    area.reactivatedAt ??= DateTime.now()
  })
  .state('boundaryCoordinates', (area) => {
    area.latitude = -90
    area.longitude = 180
  })
  .build()
