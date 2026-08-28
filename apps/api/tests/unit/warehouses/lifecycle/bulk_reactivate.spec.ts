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
import ReactivateWarehousesUseCase from '#warehouses/reactivate/reactivate_warehouses_use_case'

async function warehouse(name: string, ...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  const record = await factory.merge({ name }).create()
  await WarehouseFootprintPoint.createMany(
    [1, 2, 3].map((step, position) => ({
      warehouseId: record.id,
      position,
      latitude: 49.49 + step / 1000,
      longitude: 0.107 + step / 1000,
    })),
  )

  return record
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

const useCase = () => app.container.make(ReactivateWarehousesUseCase)

const reactivate = async (ids: string[], actorId: string, comment?: string | null) =>
  (await useCase()).handle({
    ids,
    reactivatedByUserId: actorId,
    reactivatedAt: DateTime.now(),
    comment,
  })

test.group('ReactivateWarehousesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('reactivates every warehouse in a fully eligible selection', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const first = await warehouse('First Shed', 'archived')
    const second = await warehouse('Second Shed', 'archived')

    const result = await reactivate([first.id, second.id], actor.id, 'Zone reopened')

    assert.lengthOf(result.updatedWarehouses, 2)
    assert.isEmpty(result.blockedWarehouses)
    for (const id of [first.id, second.id]) {
      assert.equal((await Warehouse.findOrFail(id)).status, 'AVAILABLE')
    }
  })

  test('reports each blocker in request order with exactly one reason', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await warehouse('Eligible Shed', 'archived')
    const alreadyAvailable = await warehouse('Open Shed')

    const result = await reactivate([eligible.id, alreadyAvailable.id, UNKNOWN_ID], actor.id)

    assert.deepEqual(
      result.updatedWarehouses.map((entry) => entry.id),
      [eligible.id],
    )
    assert.deepEqual(result.blockedWarehouses, [
      { id: alreadyAvailable.id, name: 'Open Shed', reason: 'ALREADY_AVAILABLE' },
      { id: UNKNOWN_ID, reason: 'NOT_FOUND' },
    ])
  })

  // `IN_USE` belongs to archival: an archived warehouse holds no door in a planned or active
  // discharge by construction, so the reason set here is exactly two.
  test('never reports a usage blocker', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const target = await warehouse('Busy Shed', 'archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'A door' })
      .create()

    const result = await reactivate([target.id], actor.id)

    assert.isEmpty(result.blockedWarehouses)
    assert.lengthOf(result.updatedWarehouses, 1)
  })

  test('returns the reactivated warehouses in submission order', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alpha = await warehouse('Alpha Shed', 'archived')
    const beta = await warehouse('Beta Shed', 'archived')
    const gamma = await warehouse('Gamma Shed', 'archived')

    const result = await reactivate([gamma.id, alpha.id, beta.id], actor.id)

    assert.deepEqual(
      result.updatedWarehouses.map((entry) => entry.id),
      [gamma.id, alpha.id, beta.id],
    )
  })

  test('gives every warehouse and restored door one shared lifecycle context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const first = await warehouse('Shared First', 'archived')
    const second = await warehouse('Shared Second', 'archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: first.id, name: 'First door' })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: second.id, name: 'Second door' })
      .create()

    const result = await reactivate([first.id, second.id], actor.id, 'One reopening')

    const [reference] = result.updatedWarehouses
    for (const entry of result.updatedWarehouses) {
      assert.equal(entry.reactivatedAt?.toISO(), reference.reactivatedAt?.toISO())
      assert.equal(entry.reactivationComment, 'One reopening')
      assert.equal(entry.reactivatedByUserId, actor.id)
    }
    for (const door of await WarehouseDoor.query().whereIn('warehouseId', [first.id, second.id])) {
      assert.equal(door.status, 'AVAILABLE')
      assert.equal(door.reactivatedAt?.toISO(), reference.reactivatedAt?.toISO())
      assert.equal(door.reactivationComment, 'One reopening')
    }
  })

  test('records the comment against no warehouse it did not reactivate', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await warehouse('Moved Shed', 'archived')
    const blocked = await warehouse('Untouched Shed')

    await reactivate([eligible.id, blocked.id], actor.id, 'Only for the eligible one')

    assert.isNull((await Warehouse.findOrFail(blocked.id)).reactivationComment)
  })

  test('restores every door of each reactivated warehouse', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const target = await warehouse('Mixed Shed', 'archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'Cascaded' })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'Solo', archiveComment: 'Retired on its own' })
      .create()

    await reactivate([target.id], actor.id)

    const doors = await WarehouseDoor.query().where('warehouseId', target.id).orderBy('name', 'asc')
    assert.isTrue(doors.every((door) => door.status === 'AVAILABLE'))
  })

  test('changes nothing when every warehouse in the selection is blocked', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const available = await warehouse('Open Already')

    const result = await reactivate([available.id, UNKNOWN_ID], actor.id)

    assert.isEmpty(result.updatedWarehouses)
    assert.lengthOf(result.blockedWarehouses, 2)
    assert.isNull((await Warehouse.findOrFail(available.id)).reactivatedAt)
  })

  test('leaves a blocked warehouse doors untouched', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const blocked = await warehouse('Open With Archived Door')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: blocked.id, name: 'Stale door' })
      .create()

    await reactivate([blocked.id], actor.id)

    const [door] = await WarehouseDoor.query().where('warehouseId', blocked.id)
    assert.equal(door.status, 'ARCHIVED')
    assert.isNull(door.reactivatedAt)
  })

  test('trims the shared comment and records none when it is whitespace only', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const padded = await warehouse('Padded Shed', 'archived')
    const blank = await warehouse('Blank Shed', 'archived')

    const withPadding = await reactivate([padded.id], actor.id, '  Zone reopened  ')
    const withBlank = await reactivate([blank.id], actor.id, '   ')

    assert.equal(withPadding.updatedWarehouses[0].reactivationComment, 'Zone reopened')
    assert.isNull(withBlank.updatedWarehouses[0].reactivationComment)
  })

  test('preserves the archive context of every reactivated warehouse', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const target = await warehouse('Historied Shed', 'archived')
    await Warehouse.query()
      .where('id', target.id)
      .update({ archiveComment: 'Closed for works', archivedByUserId: actor.id })

    const result = await reactivate([target.id], actor.id, 'Reopened')

    assert.equal(result.updatedWarehouses[0].archiveComment, 'Closed for works')
    assert.equal(result.updatedWarehouses[0].archivedByUserId, actor.id)
    assert.isNotNull(result.updatedWarehouses[0].archivedAt)
  })

  test('reactivates an empty-door and an all-solo-door warehouse alike', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const doorless = await warehouse('Doorless Shed', 'archived')
    const soloOnly = await warehouse('Solo Only Shed', 'archived')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: soloOnly.id, name: 'Solo' })
      .create()

    const result = await reactivate([doorless.id, soloOnly.id], actor.id)

    assert.lengthOf(result.updatedWarehouses, 2)
    assert.isEmpty(result.blockedWarehouses)
  })
})
