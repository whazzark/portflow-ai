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
import ReactivateWarehouseUseCase from '#warehouses/reactivate/reactivate_warehouse_use_case'

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

// Sequenced rather than faked: `warehouses_name_unique` spans both lifecycle states, so a faker
// collision between two warehouses in one test would fail on the index, not on behaviour.
let nextWarehouseName = 0

async function warehouseWithFootprint(...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  nextWarehouseName += 1
  const warehouse = await factory.merge({ name: `Restorable ${nextWarehouseName}` }).create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const doorsOf = (warehouseId: string) =>
  WarehouseDoor.query().where('warehouseId', warehouseId).orderBy('name', 'asc')

const reactivate = async (id: string, actorId: string, comment?: string | null) =>
  (await app.container.make(ReactivateWarehouseUseCase)).handle({
    id,
    reactivatedByUserId: actorId,
    reactivatedAt: DateTime.now(),
    comment,
  })

test.group('Warehouse reactivation door restore', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('restores every door of the warehouse, sharing its lifecycle context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'A door' })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'B door' })
      .create()

    const result = await reactivate(warehouse.id, actor.id, 'Zone reopened')

    assert.equal(result.reactivatedDoorCount, 2)
    for (const door of await doorsOf(warehouse.id)) {
      assert.equal(door.status, 'AVAILABLE')
      assert.equal(door.reactivatedByUserId, actor.id)
      assert.equal(door.reactivationComment, 'Zone reopened')
      assert.equal(
        door.reactivatedAt?.toISO(),
        result.warehouse.reactivatedAt?.toISO(),
        'a restored door shares the warehouse reactivation instant',
      )
    }
  })

  // The strict mirror of the cascade: the archival took every door of the warehouse, including one
  // retired beforehand and taken over by it, so the restore gives every one of them back. Nothing
  // under an archived warehouse is archived on its own any more.
  test('restores a door that had been archived on its own before the cascade', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Cascaded' })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: warehouse.id,
        name: 'Solo',
        archivedAt: DateTime.now().minus({ days: 30 }),
        archiveComment: 'Retired on its own',
      })
      .create()

    const result = await reactivate(warehouse.id, actor.id, 'Zone reopened')

    assert.equal(result.reactivatedDoorCount, 2)
    const [cascaded, solo] = await doorsOf(warehouse.id)
    assert.equal(cascaded.status, 'AVAILABLE')
    assert.equal(solo.status, 'AVAILABLE')
    assert.equal(solo.reactivationComment, 'Zone reopened')
    assert.equal(solo.reactivatedAt?.toISO(), result.warehouse.reactivatedAt?.toISO())
  })

  test('preserves the archive context on every restored door', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    const archivedAt = DateTime.now().minus({ days: 7 })
    await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: warehouse.id,
        name: 'A door',
        archivedAt,
        archivedByUserId: actor.id,
        archiveComment: 'Zone closed',
      })
      .create()

    await reactivate(warehouse.id, actor.id, 'Zone reopened')

    const [door] = await doorsOf(warehouse.id)
    assert.equal(door.archivedAt?.toUnixInteger(), archivedAt.toUnixInteger())
    assert.equal(door.archivedByUserId, actor.id)
    assert.equal(door.archiveComment, 'Zone closed')
  })

  test('preserves every door identity attribute', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    const created = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'A door', latitude: 49.4931, longitude: 0.108 })
      .create()

    await reactivate(warehouse.id, actor.id)

    const [door] = await doorsOf(warehouse.id)
    assert.equal(door.id, created.id)
    assert.equal(door.name, 'A door')
    assert.equal(door.warehouseId, warehouse.id)
    assert.equal(Number(door.latitude), 49.4931)
    assert.equal(Number(door.longitude), 0.108)
  })

  test('reactivates a warehouse holding no door at all', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')

    const result = await reactivate(warehouse.id, actor.id)

    assert.equal(result.warehouse.status, 'AVAILABLE')
    assert.equal(result.reactivatedDoorCount, 0)
  })

  // An available door under an archived warehouse is unreachable through the interface — the
  // cascade takes every door — so this states the invariant the unguarded update relies on rather
  // than a state an administrator can produce: every door of the warehouse ends in the warehouse's
  // own state, whatever it was in before.
  test('leaves an available door of an archived warehouse available', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Already open' }).create()

    const result = await reactivate(warehouse.id, actor.id)

    assert.equal(result.reactivatedDoorCount, 1)
    const [door] = await doorsOf(warehouse.id)
    assert.equal(door.status, 'AVAILABLE')
  })

  /**
   * The full cycle, and what the two transitions being exact mirrors means over time.
   *
   * Archive W (D goes with it) → reactivate W (D comes back) → archive D on its own → archive W
   * (the building takes D over, overwriting the context D recorded) → reactivate W. D returns to
   * service with the building, because under an archived warehouse there is no such thing as a
   * door archived on its own.
   */
  test('returns a door archived on its own once its warehouse takes it over', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    const door = await WarehouseDoorFactory.merge({
      warehouseId: warehouse.id,
      name: 'Cycled door',
    }).create()
    const archiveUseCase = await app.container.make(ArchiveWarehouseUseCase)
    const archiveWarehouse = () =>
      archiveUseCase.handle({
        id: warehouse.id,
        archivedByUserId: actor.id,
        archivedAt: DateTime.now(),
        comment: null,
      })

    await archiveWarehouse()
    await reactivate(warehouse.id, actor.id)

    // The door is now retired on its own — until the next archival of its warehouse takes it over.
    await door
      .merge({
        status: 'ARCHIVED',
        archivedAt: DateTime.now(),
        archiveComment: 'Retired on its own',
      })
      .save()

    await archiveWarehouse()
    const result = await reactivate(warehouse.id, actor.id, 'Zone reopened')

    const [stored] = await doorsOf(warehouse.id)
    assert.equal(stored.status, 'AVAILABLE', 'a door returns with the building that took it over')
    assert.isNull(stored.archiveComment, 'the warehouse overwrote the context the door recorded')
    assert.equal(stored.reactivationComment, 'Zone reopened')
    assert.equal(result.reactivatedDoorCount, 1)
  })
})
