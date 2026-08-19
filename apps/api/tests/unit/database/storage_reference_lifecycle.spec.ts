import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import { DEMO_LIFECYCLE_TIMESTAMPS } from '../../fixtures/site_reference_seeders.ts'

test.group('Storage reference lifecycle persistence', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('persists and reloads archived warehouse lifecycle facts and actor', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const archivedAt = DateTime.fromISO(DEMO_LIFECYCLE_TIMESTAMPS.archivedOnlyAt)
    const warehouse = await WarehouseFactory.apply('archived')
      .merge({
        archivedAt,
        archivedByUserId: actor.id,
        archiveComment: 'Storage area retired from operational use',
      })
      .create()

    const reloaded = await Warehouse.findOrFail(warehouse.id)
    await reloaded.load('archivedBy')

    assert.equal(reloaded.status, 'ARCHIVED')
    assert.equal(reloaded.archivedAt?.toMillis(), archivedAt.toMillis())
    assert.equal(reloaded.archivedBy.id, actor.id)
    assert.equal(reloaded.archiveComment, 'Storage area retired from operational use')
  })

  test('persists reactivated door history without changing containment', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await WarehouseFactory.create()
    const archivedAt = DateTime.fromISO(DEMO_LIFECYCLE_TIMESTAMPS.archivedAt)
    const reactivatedAt = DateTime.fromISO(DEMO_LIFECYCLE_TIMESTAMPS.reactivatedAt)
    const door = await WarehouseDoorFactory.apply('reactivated')
      .merge({
        warehouseId: warehouse.id,
        archivedAt,
        archivedByUserId: actor.id,
        archiveComment: 'Door unavailable during structural repairs',
        reactivatedAt,
        reactivatedByUserId: actor.id,
        reactivationComment: 'Structural repairs accepted',
      })
      .create()

    const reloaded = await WarehouseDoor.findOrFail(door.id)
    await reloaded.load('warehouse')
    await reloaded.load('archivedBy')
    await reloaded.load('reactivatedBy')

    assert.equal(reloaded.status, 'AVAILABLE')
    assert.equal(reloaded.warehouse.id, warehouse.id)
    assert.equal(reloaded.archivedAt?.toMillis(), archivedAt.toMillis())
    assert.equal(reloaded.reactivatedAt?.toMillis(), reactivatedAt.toMillis())
    assert.equal(reloaded.archivedBy.id, actor.id)
    assert.equal(reloaded.reactivatedBy.id, actor.id)
  })

  test('keeps lifecycle occurrences and comments when the historical actor is deleted', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const archivedAt = DateTime.fromISO(DEMO_LIFECYCLE_TIMESTAMPS.archivedOnlyAt)
    const warehouse = await WarehouseFactory.apply('archived')
      .merge({
        archivedAt,
        archivedByUserId: actor.id,
        archiveComment: 'Actor may later leave the organization',
      })
      .create()

    await actor.delete()
    await warehouse.refresh()

    assert.isNull(warehouse.archivedByUserId)
    assert.equal(warehouse.archivedAt?.toMillis(), archivedAt.toMillis())
    assert.equal(warehouse.archiveComment, 'Actor may later leave the organization')
  })

  test('factory states expose coherent available archived and reactivated storage scenarios', async ({
    assert,
  }) => {
    const warehouse = await WarehouseFactory.create()
    const archivedWarehouse = await WarehouseFactory.apply('archived').create()
    const reactivatedWarehouse = await WarehouseFactory.apply('reactivated').create()
    const availableDoor = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()
    const archivedDoor = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id })
      .create()
    const reactivatedDoor = await WarehouseDoorFactory.apply('reactivated')
      .merge({ warehouseId: warehouse.id })
      .create()

    assert.equal(warehouse.status, 'AVAILABLE')
    assert.isNull(warehouse.archivedAt)
    assert.equal(archivedWarehouse.status, 'ARCHIVED')
    assert.isNotNull(archivedWarehouse.archivedAt)
    assert.equal(reactivatedWarehouse.status, 'AVAILABLE')
    assert.isBelow(
      reactivatedWarehouse.archivedAt?.toMillis() ?? 0,
      reactivatedWarehouse.reactivatedAt?.toMillis() ?? 0,
    )
    assert.equal(availableDoor.status, 'AVAILABLE')
    assert.equal(archivedDoor.status, 'ARCHIVED')
    assert.isNotNull(archivedDoor.archivedAt)
    assert.equal(reactivatedDoor.status, 'AVAILABLE')
    assert.isBelow(
      reactivatedDoor.archivedAt?.toMillis() ?? 0,
      reactivatedDoor.reactivatedAt?.toMillis() ?? 0,
    )
  })
})
