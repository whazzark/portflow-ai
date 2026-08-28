import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

/** Comfortably inside TRIANGLE, which spans longitude ~0.1081–0.1091 at this latitude. */
const INSIDE = { latitude: 49.4935, longitude: 0.1085 }

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function warehouseWith(...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  const warehouse = await factory.create()
  await WarehouseFootprintPoint.createMany(
    TRIANGLE.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const availableWarehouse = () => warehouseWith()
const archivedWarehouse = () => warehouseWith('archived')

/** Archived on its own, which is what an archived door of an *available* warehouse is — the only
 * shape this endpoint accepts. */
const doorArchivedAlone = (warehouseId: string, name = 'Door 3', archiveComment = 'Works') =>
  WarehouseDoorFactory.apply('archived')
    .merge({
      warehouseId,
      name,
      ...INSIDE,
      archivedAt: DateTime.now().minus({ days: 3 }),
      archiveComment,
    })
    .create()

/** Archived by its warehouse's archival, which is what any door of an *archived* warehouse is
 * (#210 takes every one) — it comes back only with that warehouse. */
const doorArchivedWithWarehouse = (warehouseId: string, name = 'Cascaded door') =>
  WarehouseDoorFactory.apply('archived')
    .merge({ warehouseId, name, ...INSIDE })
    .create()

const availableDoor = (warehouseId: string, name = 'Open door') =>
  WarehouseDoorFactory.merge({ warehouseId, name, ...INSIDE }).create()

const url = (id: string) => `/api/v1/warehouse-doors/${id}/reactivate`

const errorOf = (response: { body(): unknown }) =>
  (response.body() as { error?: { code?: string; message?: string } }).error ?? {}

test.group('Warehouse door reactivation', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('reactivates a door archived on its own, recording actor, time, and comment', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)
    // Re-read rather than trusting the in-memory instance: SQLite stores timestamps to the second,
    // so the factory's sub-second precision would make "unchanged" assertions fail spuriously.
    const before = await WarehouseDoor.findOrFail(door.id)

    const response = await client
      .post(url(door.id))
      .loginAs(admin)
      .json({ comment: 'Back in service after works' })

    response.assertStatus(200)
    // The 200 is where the administrator observes what was recorded, so it carries the reactivation
    // context beside the archive one the transition preserved.
    const body = response.body().data as {
      id: string
      status: string
      archivedAt: string
      archiveComment: string
      reactivatedAt: string
      reactivatedByUserId: string
      reactivationComment: string
    }

    assert.equal(body.id, door.id)
    assert.equal(body.status, 'AVAILABLE')
    assert.equal(body.reactivatedByUserId, admin.id)
    assert.isNotNull(body.reactivatedAt)
    assert.equal(body.reactivationComment, 'Back in service after works')
    assert.equal(body.archiveComment, 'Works')
    assert.isNotNull(body.archivedAt)

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.status, 'AVAILABLE')
    assert.equal(persisted.reactivatedByUserId, admin.id)
    assert.isNotNull(persisted.reactivatedAt)
    assert.equal(persisted.reactivationComment, 'Back in service after works')

    // Nothing but the lifecycle moved.
    assert.equal(persisted.name, 'Door 3')
    assert.equal(persisted.warehouseId, warehouse.id)
    assert.equal(persisted.latitude, INSIDE.latitude)
    assert.equal(persisted.longitude, INSIDE.longitude)
    assert.equal(persisted.createdAt.toMillis(), before.createdAt.toMillis())

    // The archive context stays readable beside the new reactivation context.
    assert.equal(persisted.archivedAt?.toMillis(), before.archivedAt?.toMillis())
    assert.equal(persisted.archiveComment, 'Works')
  })

  test('advances updatedAt to the reactivation time', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)
    const before = await WarehouseDoor.findOrFail(door.id)

    const response = await client.post(url(door.id)).loginAs(admin).json({})

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.isAtLeast(persisted.updatedAt.toMillis(), before.updatedAt.toMillis())
    assert.equal(persisted.updatedAt.toMillis(), persisted.reactivatedAt?.toMillis())
  })

  test('records no comment when none is supplied', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(admin).json({})

    response.assertStatus(200)
    assert.isNull((await WarehouseDoor.findOrFail(door.id)).reactivationComment)
  })

  test('records no comment when the supplied one is whitespace only', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(admin).json({ comment: '   ' })

    response.assertStatus(200)
    assert.isNull((await WarehouseDoor.findOrFail(door.id)).reactivationComment)
  })

  test('offers the reactivated door again for new operational work', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    await client.post(url(door.id)).loginAs(admin).json({})

    const available = await client.get('/api/v1/warehouse-doors/available').loginAs(admin)

    available.assertStatus(200)
    assert.include(
      (available.body().data as Array<{ id: string }>).map((entry) => entry.id),
      door.id,
    )
  })

  test('leaves every other door of the warehouse untouched', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const target = await doorArchivedAlone(warehouse.id, 'Target')
    const sibling = await doorArchivedAlone(warehouse.id, 'Sibling')
    const open = await availableDoor(warehouse.id)

    const response = await client.post(url(target.id)).loginAs(admin).json({})

    response.assertStatus(200)
    assert.equal((await WarehouseDoor.findOrFail(sibling.id)).status, 'ARCHIVED')
    assert.isNull((await WarehouseDoor.findOrFail(sibling.id)).reactivatedAt)
    assert.equal((await WarehouseDoor.findOrFail(open.id)).status, 'AVAILABLE')
    assert.equal((await Warehouse.findOrFail(warehouse.id)).status, 'AVAILABLE')
  })

  test('refuses a door that is already available', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(admin).json({})

    response.assertStatus(409)
    assert.equal(errorOf(response).code, 'E_WAREHOUSE_DOOR_ALREADY_AVAILABLE')
    assert.isNull((await WarehouseDoor.findOrFail(door.id)).reactivatedAt)
  })

  test('refuses a door archived through its warehouse, pointing at the warehouse', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await archivedWarehouse()
    const door = await doorArchivedWithWarehouse(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(admin).json({})

    response.assertStatus(409)
    assert.equal(errorOf(response).code, 'E_WAREHOUSE_DOOR_ARCHIVED_WITH_WAREHOUSE')

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.status, 'ARCHIVED')
    assert.isNull(persisted.reactivatedAt)
  })

  // Every archived door of an archived warehouse was archived with it, so the refusal is one
  // sentence with a one-step remedy — never the generic "reactivate the warehouse first", which
  // would send the administrator back here for a second submission they do not need to make.
  test('names the one-step remedy in the refusal', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await archivedWarehouse()
    const door = await doorArchivedWithWarehouse(warehouse.id, 'Cascaded')

    const response = await client.post(url(door.id)).loginAs(admin).json({})

    assert.match(String(errorOf(response).message), /returns with it/)
    assert.notMatch(String(errorOf(response).message), /Reactivate the warehouse first/)
  })

  test('refuses a door that does not exist without disclosing others', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const other = await doorArchivedAlone(warehouse.id, 'Untouched')

    const response = await client
      .post(url('018f80c0-8799-7cb0-bb14-2d2c8d206a8c'))
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(errorOf(response).code, 'E_WAREHOUSE_DOOR_NOT_FOUND')
    assert.notInclude(JSON.stringify(response.body()), 'Untouched')
    assert.equal((await WarehouseDoor.findOrFail(other.id)).status, 'ARCHIVED')
  })

  test('answers a malformed identifier as not found rather than a server error', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()

    const response = await client.post(url('not-a-uuid')).loginAs(admin).json({})

    response.assertStatus(404)
    assert.equal(errorOf(response).code, 'E_WAREHOUSE_DOOR_NOT_FOUND')
  })

  test('rejects unauthenticated reactivation', async ({ assert, client }) => {
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client.post(url(door.id)).json({})

    response.assertStatus(401)
    assert.equal((await WarehouseDoor.findOrFail(door.id)).status, 'ARCHIVED')
  })

  test('denies an active user without warehouse-door management permission', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(observer).json({})

    response.assertStatus(403)
    assert.equal((await WarehouseDoor.findOrFail(door.id)).status, 'ARCHIVED')
  })

  test('denies a user whose access is not active', async ({ assert, client }) => {
    const suspended = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client.post(url(door.id)).loginAs(suspended).json({})

    assert.isAbove(response.status(), 399)
    assert.equal((await WarehouseDoor.findOrFail(door.id)).status, 'ARCHIVED')
  })

  test('refuses a comment longer than the shared lifecycle limit', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client
      .post(url(door.id))
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await WarehouseDoor.findOrFail(door.id)).status, 'ARCHIVED')
  })

  test('accepts a comment at exactly the shared lifecycle limit', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const response = await client
      .post(url(door.id))
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1000) })

    response.assertStatus(200)
    assert.lengthOf((await WarehouseDoor.findOrFail(door.id)).reactivationComment ?? '', 1000)
  })

  test('records exactly one reactivation under concurrent submissions', async ({
    assert,
    client,
  }) => {
    const first = await administrator()
    const second = await administrator()
    const warehouse = await availableWarehouse()
    const door = await doorArchivedAlone(warehouse.id)

    const [left, right] = await Promise.all([
      client.post(url(door.id)).loginAs(first).json({ comment: 'first' }),
      client.post(url(door.id)).loginAs(second).json({ comment: 'second' }),
    ])

    const statuses = [left.status(), right.status()].sort((a, b) => a - b)
    assert.deepEqual(statuses, [200, 409])

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.status, 'AVAILABLE')
    // Exactly one context recorded: the loser must not overwrite the winner's.
    assert.oneOf(persisted.reactivationComment, ['first', 'second'])
    assert.oneOf(persisted.reactivatedByUserId, [first.id, second.id])
  })

  test('never leaves a door available without a complete reactivation context', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const available = await availableWarehouse()
    const archived = await archivedWarehouse()
    const refused = [
      await availableDoor(available.id, 'Already available'),
      await doorArchivedWithWarehouse(archived.id, 'Cascaded'),
      await doorArchivedWithWarehouse(archived.id, 'Cascaded sibling'),
    ]

    for (const door of refused) {
      await client.post(url(door.id)).loginAs(admin).json({ comment: 'attempt' })
    }

    for (const door of await WarehouseDoor.all()) {
      if (door.status === 'AVAILABLE' && door.reactivatedAt !== null) {
        assert.isNotNull(door.reactivatedByUserId)
      }

      // No door ends available under an archived warehouse.
      if (door.status === 'AVAILABLE') {
        assert.equal((await Warehouse.findOrFail(door.warehouseId)).status, 'AVAILABLE')
      }
    }
  })
})
