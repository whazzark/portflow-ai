import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import ReactivateWarehouseUseCase from '#warehouses/reactivate/reactivate_warehouse_use_case'
import {
  WarehouseAlreadyAvailableException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

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
  const warehouse = await factory.merge({ name: `Reactivable ${nextWarehouseName}` }).create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

function reactivateInput(id: string, actorId: string, comment?: string | null) {
  return { id, reactivatedByUserId: actorId, reactivatedAt: DateTime.now(), comment }
}

const useCase = () => app.container.make(ReactivateWarehouseUseCase)

test.group('ReactivateWarehouseUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates an archived warehouse and records its lifecycle context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const warehouse = await warehouseWithFootprint('archived')

    const result = await (await useCase()).handle(
      reactivateInput(warehouse.id, actor.id, '  Zone reopened  '),
    )

    assert.equal(result.warehouse.status, 'AVAILABLE')
    assert.equal(result.warehouse.reactivatedByUserId, actor.id)
    assert.equal(result.warehouse.reactivationComment, 'Zone reopened')
    assert.isNotNull(result.warehouse.reactivatedAt)
  })

  test('records no comment when none is supplied or it is whitespace only', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const absent = await warehouseWithFootprint('archived')
    const blank = await warehouseWithFootprint('archived')

    const withoutComment = await (await useCase()).handle(reactivateInput(absent.id, actor.id))
    const withBlank = await (await useCase()).handle(reactivateInput(blank.id, actor.id, '   '))

    assert.isNull(withoutComment.warehouse.reactivationComment)
    assert.isNull(withBlank.warehouse.reactivationComment)
  })

  test('preserves identity, name, footprint, and creation time', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')

    const result = await (await useCase()).handle(reactivateInput(warehouse.id, actor.id))

    assert.equal(result.warehouse.id, warehouse.id)
    assert.equal(result.warehouse.name, warehouse.name)
    // SQLite (the test database) stores second precision; compare the instant, not the string.
    assert.equal(result.warehouse.createdAt.toUnixInteger(), warehouse.createdAt.toUnixInteger())
    assert.lengthOf(result.warehouse.footprintPoints, 3)
  })

  // The archive context is what makes the period spent archived consultable afterwards, so
  // reactivation must add its own context beside it rather than clearing it (FR-015).
  test('preserves the archive context that preceded the reactivation', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const archivedAt = DateTime.now().minus({ days: 5 })
    const warehouse = await warehouseWithFootprint('archived')
    await warehouse
      .merge({ archivedAt, archivedByUserId: actor.id, archiveComment: 'Works' })
      .save()

    const result = await (await useCase()).handle(reactivateInput(warehouse.id, actor.id, 'Back'))

    assert.isNotNull(result.warehouse.archivedAt)
    assert.equal(result.warehouse.archivedByUserId, actor.id)
    assert.equal(result.warehouse.archiveComment, 'Works')
    assert.equal(result.warehouse.reactivationComment, 'Back')
  })

  test('refuses a warehouse that is already available', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()

    await assert.rejects(
      () => useCase().then((instance) => instance.handle(reactivateInput(warehouse.id, actor.id))),
      WarehouseAlreadyAvailableException.message,
    )

    const stored = await Warehouse.findOrFail(warehouse.id)
    assert.equal(stored.status, 'AVAILABLE')
    assert.isNull(stored.reactivatedAt)
  })

  test('refuses an identifier that resolves to no warehouse', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()

    await assert.rejects(
      () =>
        useCase().then((instance) =>
          instance.handle(reactivateInput('00000000-0000-4000-8000-000000000000', actor.id)),
        ),
      WarehouseNotFoundException.message,
    )
  })

  test('leaves the stored lifecycle context untouched when the attempt is refused', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('reactivated')
    const before = await Warehouse.findOrFail(warehouse.id)

    await assert.rejects(() =>
      useCase().then((instance) => instance.handle(reactivateInput(warehouse.id, actor.id, 'x'))),
    )

    const after = await Warehouse.findOrFail(warehouse.id)
    assert.equal(after.status, before.status)
    assert.equal(after.reactivatedAt?.toISO(), before.reactivatedAt?.toISO())
    assert.equal(after.reactivationComment, before.reactivationComment)
  })

  // Available and archived are the only states, and a warehouse may cycle between them without
  // limit; each direction replaces its own context rather than accumulating a log (FR-025).
  test('supports repeated archive and reactivate cycles', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint('archived')

    const first = await (await useCase()).handle(reactivateInput(warehouse.id, actor.id, 'first'))
    // Re-archived through a query rather than the stale in-memory instance, whose `status` still
    // reads ARCHIVED and would make `save()` a no-op.
    await Warehouse.query()
      .where('id', warehouse.id)
      .update({ status: 'ARCHIVED', archivedAt: DateTime.now().toSQL({ includeOffset: false }) })
    const second = await (await useCase()).handle(reactivateInput(warehouse.id, actor.id, 'second'))

    assert.equal(first.warehouse.reactivationComment, 'first')
    assert.equal(second.warehouse.reactivationComment, 'second')
    assert.equal(second.warehouse.status, 'AVAILABLE')
  })
})
