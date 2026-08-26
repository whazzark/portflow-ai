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
const OUTSIDE = { latitude: 49.49, longitude: 0.1085 }

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function availableWarehouse(points = TRIANGLE) {
  const warehouse = await WarehouseFactory.create()
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

test.group('Warehouse door creation', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('creates an available door at the submitted position', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Door 3', ...INSIDE })

    response.assertStatus(201)
    const created = response.body().data
    assert.equal(created.name, 'Door 3')
    assert.equal(created.warehouseId, warehouse.id)
    assert.equal(created.status, 'AVAILABLE')
    assert.equal(created.latitude, INSIDE.latitude)
    assert.equal(created.longitude, INSIDE.longitude)
    assert.isNotNull(created.createdAt)

    const persisted = await WarehouseDoor.findOrFail(created.id)
    assert.equal(persisted.warehouseId, warehouse.id)
    assert.equal(persisted.name, 'Door 3')
    assert.equal(persisted.status, 'AVAILABLE')
    assert.equal(persisted.latitude, INSIDE.latitude)
    assert.equal(persisted.longitude, INSIDE.longitude)
  })

  test('trims the submitted name before storing it', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: '  Door 4  ', ...INSIDE })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Door 4')
    assert.equal((await WarehouseDoor.findOrFail(response.body().data.id)).name, 'Door 4')
  })

  test('ignores a lifecycle state supplied by the caller', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Door 5', ...INSIDE, status: 'ARCHIVED' })

    response.assertStatus(201)
    assert.equal(response.body().data.status, 'AVAILABLE')
  })

  test('accepts a position lying exactly on the footprint boundary', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Corner door', ...TRIANGLE[0] })

    response.assertStatus(201)
    assert.equal(response.body().data.latitude, TRIANGLE[0].latitude)
  })

  test('refuses a position outside the containing footprint', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Stray door', ...OUTSIDE })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT')
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 0)
  })
})

test.group('Warehouse door creation — rejections', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('rejects a blank name', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: '   ', ...INSIDE })

    response.assertStatus(422)
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 0)
  })

  test('rejects a name longer than the site-reference limit', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'D'.repeat(256), ...INSIDE })

    response.assertStatus(422)
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 0)
  })

  test('rejects an out-of-range coordinate', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Door 9', latitude: 91, longitude: 0.1085 })

    response.assertStatus(422)
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 0)
  })

  test('rejects a name already used by a door of the same warehouse', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Door 1', ...INSIDE })

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: '  dOoR 1  ', ...INSIDE })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NAME_CONFLICT')
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 1)
  })

  test('keeps an archived door’s name reserved in its warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: warehouse.id, name: 'Retired Door' })
      .create()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'retired door', ...INSIDE })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NAME_CONFLICT')
  })

  test('accepts a name already used by a door of another warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const first = await availableWarehouse()
    const second = await availableWarehouse()
    await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: first.id, name: 'Door 1', ...INSIDE })

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: second.id, name: 'Door 1', ...INSIDE })

    response.assertStatus(201)
    assert.equal(response.body().data.warehouseId, second.id)
    assert.lengthOf(await WarehouseDoor.query().where('name', 'Door 1'), 2)
  })
})

test.group('Warehouse door creation — authorization and eligibility', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .json({ warehouseId: warehouse.id, name: 'Door 3', ...INSIDE })

    response.assertStatus(401)
    assert.lengthOf(await WarehouseDoor.query(), 0)
  })

  test('rejects an active user without warehouse-door management permission', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const warehouse = await availableWarehouse()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(observer)
      .json({ warehouseId: warehouse.id, name: 'Door 3', ...INSIDE })

    response.assertStatus(403)
    assert.lengthOf(await WarehouseDoor.query(), 0)
  })

  test('reports an unknown warehouse as not found', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({
        warehouseId: '018f80c0-8799-7cb0-bb14-2d2c8d206a8c',
        name: 'Door 3',
        ...INSIDE,
      })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
  })

  test('reports a malformed warehouse identifier as not found, never as a server error', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: 'not-a-uuid', name: 'Door 3', ...INSIDE })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
  })

  test('refuses an archived warehouse as read-only', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await WarehouseFactory.apply('archived').create()
    await WarehouseFootprintPoint.createMany(
      TRIANGLE.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
    )

    const response = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: warehouse.id, name: 'Door 3', ...INSIDE })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ARCHIVED')
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 0)
  })
})

test.group('Warehouse door creation — concurrency', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('creates exactly one door when the same name is submitted twice at once', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()

    const responses = await Promise.all([
      client
        .post('/api/v1/warehouse-doors')
        .loginAs(admin)
        .json({ warehouseId: warehouse.id, name: 'Door 1', ...INSIDE }),
      client
        .post('/api/v1/warehouse-doors')
        .loginAs(admin)
        .json({ warehouseId: warehouse.id, name: 'Door 1', ...INSIDE }),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [201, 409])
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 1)
  })
})
