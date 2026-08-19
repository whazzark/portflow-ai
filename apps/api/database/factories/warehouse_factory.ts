import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import Warehouse from '#models/warehouse'

export const WarehouseFactory = factory
  .define(Warehouse, ({ faker }) => ({
    name: `${faker.location.city()} Warehouse`,
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (warehouse) => {
    warehouse.status = 'ARCHIVED'
    warehouse.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (warehouse) => {
    warehouse.status = 'AVAILABLE'
    warehouse.archivedAt ??= DateTime.now().minus({ days: 30 })
    warehouse.reactivatedAt ??= DateTime.now()
  })
  .build()
