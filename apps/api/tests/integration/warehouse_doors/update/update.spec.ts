import { test } from '@japa/runner'
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
const MOVED = { latitude: 49.4936, longitude: 0.1086 }
const OUTSIDE = { latitude: 49.49, longitude: 0.1085 }
/** On the boundary: the midpoint of the triangle's top edge, a valid unloading position. */
const ON_BOUNDARY = { latitude: 49.4938, longitude: 0.10845 }

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function availableWarehouse(points = TRIANGLE) {
  const warehouse = await WarehouseFactory.create()
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const availableDoor = (warehouseId: string, name = 'Door 3') =>
  WarehouseDoorFactory.merge({ warehouseId, name, ...INSIDE }).create()

const url = (id: string) => `/api/v1/warehouse-doors/${id}`

test.group('Warehouse door update', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('corrects the name alone, leaving the position untouched', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Door 4' })

    response.assertStatus(200)
    const updated = response.body().data
    assert.equal(updated.name, 'Door 4')
    assert.equal(updated.latitude, INSIDE.latitude)
    assert.equal(updated.longitude, INSIDE.longitude)

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Door 4')
    assert.equal(persisted.latitude, INSIDE.latitude)
    assert.equal(persisted.longitude, INSIDE.longitude)
  })

  test('moves the door alone, leaving the name untouched', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json(MOVED)

    response.assertStatus(200)
    assert.equal(response.body().data.name, door.name)

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
    assert.equal(persisted.latitude, MOVED.latitude)
    assert.equal(persisted.longitude, MOVED.longitude)
  })

  test('applies a name and a position submitted together', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client
      .patch(url(door.id))
      .loginAs(admin)
      .json({ name: 'Door 4', ...MOVED })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Door 4')
    assert.equal(persisted.latitude, MOVED.latitude)
    assert.equal(persisted.longitude, MOVED.longitude)
  })

  test('preserves identity, containing warehouse, status, and creation time', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)
    const before = await WarehouseDoor.findOrFail(door.id)

    const response = await client
      .patch(url(door.id))
      .loginAs(admin)
      .json({ name: 'Door 4', ...MOVED })

    response.assertStatus(200)
    const updated = response.body().data
    assert.equal(updated.id, door.id)
    assert.equal(updated.warehouseId, warehouse.id)
    assert.equal(updated.status, 'AVAILABLE')
    assert.equal(updated.createdAt, before.createdAt.toISO())
  })

  test('records that the door was last updated', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)
    const before = await WarehouseDoor.findOrFail(door.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Door 4' })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    // Asserted as "advanced" rather than against a literal format: PostgreSQL and SQLite (the test
    // database, per ADR 0002) do not serialize timestamps identically.
    assert.isAtLeast(persisted.updatedAt.toMillis(), before.updatedAt.toMillis())
    assert.isNotNull(response.body().data.updatedAt)
  })

  test('accepts a resubmission of the current name and position unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client
      .patch(url(door.id))
      .loginAs(admin)
      .json({ name: door.name, latitude: door.latitude, longitude: door.longitude })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('accepts a case-only correction of the door’s own name', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id, 'door 3')

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Door 3' })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Door 3')
  })

  test('trims the submitted name before storing it', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: '  Door 4  ' })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Door 4')
  })

  test('accepts a position lying exactly on the footprint boundary', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json(ON_BOUNDARY)

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.latitude, ON_BOUNDARY.latitude)
  })

  test('refuses a position outside the containing footprint', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json(OUTSIDE)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT')

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.latitude, INSIDE.latitude)
    assert.equal(persisted.longitude, INSIDE.longitude)
  })

  test('rejects a blank name', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: '   ' })

    response.assertStatus(422)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('rejects a name longer than the site-reference limit', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client
      .patch(url(door.id))
      .loginAs(admin)
      .json({ name: 'a'.repeat(256) })

    response.assertStatus(422)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('rejects an out-of-range coordinate', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client
      .patch(url(door.id))
      .loginAs(admin)
      .json({ latitude: 91, longitude: 0.1085 })

    response.assertStatus(422)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.latitude, INSIDE.latitude)
  })

  test('rejects a latitude submitted without its longitude', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({ latitude: 49.4936 })

    response.assertStatus(422)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.latitude, INSIDE.latitude)
  })

  test('rejects a body carrying no correction at all', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({})

    response.assertStatus(422)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('rejects a name already used by another door of the same warehouse', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id, 'Door 3')
    await availableDoor(warehouse.id, 'Door 5')

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: '  dOOr 5 ' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NAME_CONFLICT')

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Door 3')
  })

  test('keeps an archived door’s name reserved in its warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id, 'Door 3')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Retired Door', ...INSIDE })
      .create()

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Retired Door' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NAME_CONFLICT')
  })

  test('accepts a name already used by a door of another warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const other = await availableWarehouse()
    const door = await availableDoor(warehouse.id, 'Door 3')
    await WarehouseDoorFactory.merge({
      warehouseId: other.id,
      name: 'Shared Door',
      ...INSIDE,
    }).create()

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Shared Door' })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Shared Door')
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).json({ name: 'Door 4' })

    response.assertStatus(401)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('rejects an active user without warehouse-door management permission', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)

    const response = await client.patch(url(door.id)).loginAs(observer).json({ name: 'Door 4' })

    response.assertStatus(403)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('reports an unknown door as not found', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .patch(url('018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11'))
      .loginAs(admin)
      .json({ name: 'Door 4' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NOT_FOUND')
  })

  test('reports a malformed door identifier as not found, never as a server error', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()

    const response = await client.patch(url('not-a-uuid')).loginAs(admin).json({ name: 'Door 4' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NOT_FOUND')
  })

  test('refuses an archived door as read-only', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Old Door', ...INSIDE })
      .create()

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Door 4' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_ARCHIVED')

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, 'Old Door')
    assert.equal(persisted.status, 'ARCHIVED')
  })

  test('refuses a door whose containing warehouse is archived', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const door = await availableDoor(warehouse.id)
    // The cascade normally archives the doors with the warehouse; forced apart here so the
    // warehouse's own ineligibility is what the request has to answer for.
    await Warehouse.query().where('id', warehouse.id).update({ status: 'ARCHIVED' })

    const response = await client.patch(url(door.id)).loginAs(admin).json({ name: 'Door 4' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ARCHIVED')

    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.name, door.name)
  })

  test('ignores a containing warehouse, lifecycle state, or creation time supplied by the caller', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const other = await availableWarehouse()
    const door = await availableDoor(warehouse.id)
    const before = await WarehouseDoor.findOrFail(door.id)

    const response = await client.patch(url(door.id)).loginAs(admin).json({
      name: 'Door 4',
      warehouseId: other.id,
      status: 'ARCHIVED',
      createdAt: '2000-01-01T00:00:00.000Z',
    })

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(door.id)
    assert.equal(persisted.warehouseId, warehouse.id)
    assert.equal(persisted.status, 'AVAILABLE')
    assert.equal(persisted.createdAt.toISO(), before.createdAt.toISO())
  })

  test('renames exactly one door when two claim the same name at once', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const first = await availableDoor(warehouse.id, 'Door 3')
    const second = await availableDoor(warehouse.id, 'Door 5')

    const responses = await Promise.all([
      client.patch(url(first.id)).loginAs(admin).json({ name: 'Door 9' }),
      client.patch(url(second.id)).loginAs(admin).json({ name: 'Door 9' }),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [200, 409])

    const named = await WarehouseDoor.query()
      .where('warehouse_id', warehouse.id)
      .whereRaw('LOWER(name) = ?', ['door 9'])
    assert.lengthOf(named, 1)
  })
})
