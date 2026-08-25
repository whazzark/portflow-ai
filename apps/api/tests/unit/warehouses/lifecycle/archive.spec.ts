import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import ArchiveWarehouseUseCase from '#warehouses/archive/archive_warehouse_use_case'
import {
  WarehouseAlreadyArchivedException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

// Names are sequenced rather than faked: `warehouses_name_unique` spans both lifecycle states, and
// a faker collision between two warehouses in one test would fail on the index, not on behaviour.
let nextWarehouseName = 0

async function warehouseWithFootprint(...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  nextWarehouseName += 1
  const warehouse = await factory.merge({ name: `Warehouse ${nextWarehouseName}` }).create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

function archiveInput(id: string, actorId: string, comment?: string | null) {
  return { id, archivedByUserId: actorId, archivedAt: DateTime.now(), comment }
}

test.group('ArchiveWarehouseUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives an available warehouse and records its lifecycle context', async ({ assert }) => {
    const actor = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const warehouse = await warehouseWithFootprint()

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle(
      archiveInput(warehouse.id, actor.id, '  Building repurposed  '),
    )

    assert.equal(result.warehouse.status, 'ARCHIVED')
    assert.equal(result.warehouse.archivedByUserId, actor.id)
    assert.equal(result.warehouse.archiveComment, 'Building repurposed')
    assert.isNotNull(result.warehouse.archivedAt)
  })

  test('records no comment when none is supplied or it is whitespace only', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const blank = await warehouseWithFootprint()
    const absent = await warehouseWithFootprint()
    const useCase = await app.container.make(ArchiveWarehouseUseCase)

    const withBlank = await useCase.handle(archiveInput(blank.id, actor.id, '   '))
    const withNone = await useCase.handle(archiveInput(absent.id, actor.id))

    assert.isNull(withBlank.warehouse.archiveComment)
    assert.isNull(withNone.warehouse.archiveComment)
    assert.isNotNull(withBlank.warehouse.archivedAt)
  })

  test('preserves identity, name, footprint, creation time and prior reactivation', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('reactivated')
    // Read back rather than trusting the just-created instance: the fixture holds millisecond
    // precision the column does not, so only a stored-to-stored comparison proves nothing changed.
    const stored = await Warehouse.findOrFail(warehouse.id)
    const before = {
      name: stored.name,
      createdAt: stored.createdAt.toISO(),
      reactivatedAt: stored.reactivatedAt?.toISO(),
    }

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle(
      archiveInput(warehouse.id, actor.id),
    )

    assert.equal(result.warehouse.id, warehouse.id)
    assert.equal(result.warehouse.name, before.name)
    assert.equal(result.warehouse.createdAt.toISO(), before.createdAt)
    assert.equal(result.warehouse.reactivatedAt?.toISO(), before.reactivatedAt)
    const points = await WarehouseFootprintPoint.query()
      .where('warehouseId', warehouse.id)
      .orderBy('position', 'asc')
    assert.lengthOf(points, 3)
    assert.deepEqual(
      points.map((point) => [point.latitude, point.longitude]),
      FOOTPRINT.map((point) => [point.latitude, point.longitude]),
    )
  })

  test('refuses a warehouse that does not exist', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const useCase = await app.container.make(ArchiveWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle(archiveInput('00000000-0000-4000-8000-000000000000', actor.id)),
      WarehouseNotFoundException.message,
    )
  })

  test('refuses a warehouse that is already archived and leaves its context intact', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const other = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    warehouse.archivedByUserId = other.id
    warehouse.archiveComment = 'Original reason'
    await warehouse.save()
    const useCase = await app.container.make(ArchiveWarehouseUseCase)

    await assert.rejects(
      () => useCase.handle(archiveInput(warehouse.id, actor.id, 'Second attempt')),
      WarehouseAlreadyArchivedException.message,
    )
    const reloaded = await Warehouse.findOrFail(warehouse.id)
    assert.equal(reloaded.archivedByUserId, other.id)
    assert.equal(reloaded.archiveComment, 'Original reason')
  })

  test('archives exactly once when the same warehouse is submitted twice', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Once door' }).create()
    const useCase = await app.container.make(ArchiveWarehouseUseCase)

    await useCase.handle(archiveInput(warehouse.id, actor.id, 'First'))
    const afterFirst = await Warehouse.findOrFail(warehouse.id)

    await assert.rejects(
      () => useCase.handle(archiveInput(warehouse.id, actor.id, 'Second')),
      WarehouseAlreadyArchivedException.message,
    )

    const afterSecond = await Warehouse.findOrFail(warehouse.id)
    assert.equal(afterSecond.archiveComment, 'First')
    assert.equal(afterSecond.archivedByUserId, actor.id)
    assert.equal(afterSecond.archivedAt?.toISO(), afterFirst.archivedAt?.toISO())
    const doors = await WarehouseDoor.query().where('warehouseId', warehouse.id)
    assert.isTrue(doors.every((door) => door.archiveComment === 'First'))
  })
})
