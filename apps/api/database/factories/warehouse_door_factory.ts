import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import WarehouseDoor from '#models/warehouse_door'

export const WarehouseDoorFactory = factory
  .define(WarehouseDoor, ({ faker }) => ({
    // Persisted scenarios must merge the containing warehouse id explicitly.
    warehouseId: faker.string.uuid(),
    name: `Door ${faker.number.int({ min: 1, max: 99 })}`,
    latitude: 46.1608,
    longitude: -1.2292,
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (door) => {
    door.status = 'ARCHIVED'
    door.archivedAt ??= DateTime.now()
  })
  .state('reactivated', (door) => {
    door.status = 'AVAILABLE'
    door.archivedAt ??= DateTime.now().minus({ days: 30 })
    door.reactivatedAt ??= DateTime.now()
  })
  .build()
