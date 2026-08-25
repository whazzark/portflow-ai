import factory from '@adonisjs/lucid/factories'
import { DateTime } from 'luxon'
import WarehouseDoor from '#models/warehouse_door'

/**
 * Door names are unique per warehouse, so the default name has to be a sequence: drawing from a
 * small random range made sibling doors of the same warehouse collide every so often. Starts past
 * the hand-written "Door 1"/"Door 2" names that some specs merge in.
 */
let nextDoorNumber = 100

export const WarehouseDoorFactory = factory
  .define(WarehouseDoor, ({ faker }) => ({
    // Persisted scenarios must merge the containing warehouse id explicitly.
    warehouseId: faker.string.uuid(),
    name: `Door ${nextDoorNumber++}`,
    latitude: 46.1608,
    longitude: -1.2292,
    status: 'AVAILABLE' as const,
    archivedAt: null,
    archivedByUserId: null,
    archiveComment: null,
    archivedWithWarehouse: false,
    reactivatedAt: null,
    reactivatedByUserId: null,
    reactivationComment: null,
  }))
  .state('archived', (door) => {
    door.status = 'ARCHIVED'
    door.archivedAt ??= DateTime.now()
  })
  // A door archived by its warehouse's archival rather than on its own. Reactivating the
  // warehouse (#211) restores exactly these doors.
  .state('archivedWithWarehouse', (door) => {
    door.status = 'ARCHIVED'
    door.archivedAt ??= DateTime.now()
    door.archivedWithWarehouse = true
  })
  .state('reactivated', (door) => {
    door.status = 'AVAILABLE'
    door.archivedAt ??= DateTime.now().minus({ days: 30 })
    door.reactivatedAt ??= DateTime.now()
  })
  .build()
