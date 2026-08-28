import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import ArchiveWarehouseUseCase from '#warehouses/archive/archive_warehouse_use_case'

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

// Sequenced rather than faked: `warehouses_name_unique` spans both lifecycle states, so a faker
// collision between two warehouses in one test would fail on the index, not on behaviour.
let nextWarehouseName = 0

async function warehouseWithFootprint() {
  nextWarehouseName += 1
  const warehouse = await WarehouseFactory.merge({
    name: `Warehouse ${nextWarehouseName}`,
  }).create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const doorsOf = (warehouseId: string) =>
  WarehouseDoor.query().where('warehouseId', warehouseId).orderBy('name', 'asc')

test.group('Warehouse archival door cascade', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives every door with the warehouse lifecycle context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'A door' }).create()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'B door' }).create()

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: 'Building repurposed',
    })

    assert.equal(result.archivedDoorCount, 2)
    const doors = await doorsOf(warehouse.id)
    assert.isTrue(doors.every((door) => door.status === 'ARCHIVED'))
    assert.isTrue(doors.every((door) => door.archivedByUserId === actor.id))
    assert.isTrue(doors.every((door) => door.archiveComment === 'Building repurposed'))
    assert.isTrue(
      doors.every((door) => door.archivedAt?.toISO() === result.warehouse.archivedAt?.toISO()),
    )
  })

  // The rule the cascade turns on: the building's archival is the one an archived warehouse holds,
  // so a door retired on its own beforehand is taken over by it rather than left with a context of
  // its own. Reactivating the warehouse then gives that door back with every other.
  test('overwrites the context of a door already archived on its own', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const other = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Live door' }).create()
    const previouslyArchived = await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: warehouse.id,
        name: 'Retired door',
        archivedByUserId: other.id,
        archiveComment: 'Retired on its own',
        archivedAt: DateTime.fromISO('2026-01-15T08:00:00.000Z'),
      })
      .create()

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: 'Building repurposed',
    })

    assert.equal(result.archivedDoorCount, 2)
    const taken = await WarehouseDoor.findOrFail(previouslyArchived.id)
    assert.equal(taken.status, 'ARCHIVED')
    assert.equal(taken.archivedByUserId, actor.id)
    assert.equal(taken.archiveComment, 'Building repurposed')
    assert.equal(taken.archivedAt?.toISO(), result.warehouse.archivedAt?.toISO())
  })

  test('archives a warehouse that has no door at all', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(result.warehouse.status, 'ARCHIVED')
    assert.equal(result.archivedDoorCount, 0)
  })

  test('re-archives a warehouse whose doors are all already archived', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Closed door' })
      .create()

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(result.warehouse.status, 'ARCHIVED')
    assert.equal(result.archivedDoorCount, 1)
  })

  test('preserves every door identity, name, location and prior reactivation', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    const reactivated = await WarehouseDoorFactory.apply('reactivated')
      .merge({
        warehouseId: warehouse.id,
        name: 'Repaired door',
        latitude: 49.4931,
        longitude: 0.1085,
        reactivationComment: 'Returned to service',
      })
      .create()

    await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    const reloaded = await WarehouseDoor.findOrFail(reactivated.id)
    assert.equal(reloaded.name, 'Repaired door')
    assert.equal(reloaded.latitude, 49.4931)
    assert.equal(reloaded.longitude, 0.1085)
    assert.equal(reloaded.warehouseId, warehouse.id)
    assert.equal(reloaded.reactivationComment, 'Returned to service')
    assert.isNotNull(reloaded.reactivatedAt)
    assert.equal(reloaded.status, 'ARCHIVED')
  })

  test('leaves doors of other warehouses alone', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const target = await warehouseWithFootprint()
    const neighbour = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Target door' }).create()
    const neighbourDoor = await WarehouseDoorFactory.merge({
      warehouseId: neighbour.id,
      name: 'Neighbour door',
    }).create()

    await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: target.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    const untouched = await WarehouseDoor.findOrFail(neighbourDoor.id)
    assert.equal(untouched.status, 'AVAILABLE')
  })
})
