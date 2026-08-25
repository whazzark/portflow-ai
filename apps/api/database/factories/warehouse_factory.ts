import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import Warehouse from '#models/warehouse'

export const WarehouseFactory = factory
  .define(Warehouse, ({ faker }) => ({
    // Suffixed to avoid the case-insensitive unique name index colliding across the
    // finite faker.location.city() pool once enough warehouses are created in a run.
    name: `${faker.location.city()} Warehouse ${faker.string.alphanumeric({ length: 6 })}`,
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
