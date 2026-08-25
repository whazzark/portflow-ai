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

  test('restores every door archived with the warehouse, sharing its lifecycle context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: warehouse.id, name: 'A door' })
      .create()
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
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

  // The whole point of `archived_with_warehouse`: a door retired on its own must not come back
  // when the building does (FR-008).
  test('leaves a door archived on its own entirely untouched', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: warehouse.id, name: 'Cascaded' })
      .create()
    const soloArchivedAt = DateTime.now().minus({ days: 30 })
    await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: warehouse.id,
        name: 'Solo',
        archivedAt: soloArchivedAt,
        archiveComment: 'Retired on its own',
      })
      .create()

    const result = await reactivate(warehouse.id, actor.id, 'Zone reopened')

    assert.equal(result.reactivatedDoorCount, 1)
    const [cascaded, solo] = await doorsOf(warehouse.id)
    assert.equal(cascaded.status, 'AVAILABLE')
    assert.equal(solo.status, 'ARCHIVED')
    assert.equal(solo.archiveComment, 'Retired on its own')
    // SQLite (the test database) stores second precision, so the instant is compared at that
    // granularity rather than asserting a millisecond round trip the engine never promises.
    assert.equal(solo.archivedAt?.toUnixInteger(), soloArchivedAt.toUnixInteger())
    assert.isNull(solo.reactivatedAt)
    assert.isNull(solo.reactivationComment)
  })

  test('clears the cascade record on every restored door', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: warehouse.id, name: 'A door' })
      .create()

    await reactivate(warehouse.id, actor.id)

    const [door] = await doorsOf(warehouse.id)
    assert.isFalse(door.archivedWithWarehouse)
  })

  test('preserves the archive context on every restored door', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    const archivedAt = DateTime.now().minus({ days: 7 })
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
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
    const created = await WarehouseDoorFactory.apply('archivedWithWarehouse')
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

  test('reactivates a warehouse whose doors were all archived on their own', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Solo' })
      .create()

    const result = await reactivate(warehouse.id, actor.id)

    assert.equal(result.warehouse.status, 'AVAILABLE')
    assert.equal(result.reactivatedDoorCount, 0)
    const [door] = await doorsOf(warehouse.id)
    assert.equal(door.status, 'ARCHIVED')
  })

  test('leaves an available door of an archived warehouse untouched', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Already open' }).create()

    const result = await reactivate(warehouse.id, actor.id)

    assert.equal(result.reactivatedDoorCount, 0)
    const [door] = await doorsOf(warehouse.id)
    assert.equal(door.status, 'AVAILABLE')
    assert.isNull(door.reactivatedAt)
  })

  /**
   * The regression the cascade record exists to prevent, and the only test that catches a missing
   * `archived_with_warehouse = false` write. Every simpler test above passes without it.
   *
   * Archive W (D cascades) → reactivate W (D returns, record must be cleared) → archive D on its
   * own → archive W → reactivate W. If the record survived the first restore, D would be dragged
   * back into service here despite having been retired independently.
   */
  test('does not resurrect a door archived on its own after an earlier cascade', async ({
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

    // The door is now retired on its own, which the next cascade must not overwrite and the next
    // restore must not undo.
    await door
      .merge({ status: 'ARCHIVED', archivedAt: DateTime.now(), archivedWithWarehouse: false })
      .save()

    await archiveWarehouse()
    await reactivate(warehouse.id, actor.id)

    const [stored] = await doorsOf(warehouse.id)
    assert.equal(stored.status, 'ARCHIVED', 'a door retired on its own stays archived')
    assert.isFalse(stored.archivedWithWarehouse)
  })
})
