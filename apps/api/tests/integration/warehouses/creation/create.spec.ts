import { test } from '@japa/runner'
import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

const TRIANGLE = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function addFootprint(
  warehouseId: string,
  points: Array<{ latitude: number; longitude: number }> = TRIANGLE,
) {
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId, position, ...point })),
  )
}

test.group('Warehouse creation', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('creates an available warehouse with its footprint in the submitted order', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: 'North Shed', footprint: { points: TRIANGLE } })

    response.assertStatus(201)
    const created = response.body().data
    assert.equal(created.name, 'North Shed')
    assert.equal(created.status, 'AVAILABLE')
    assert.deepEqual(created.doors, [])
    assert.deepEqual(created.footprint.points, TRIANGLE)

    const persisted = await WarehouseFootprintPoint.query()
      .where('warehouse_id', created.id)
      .orderBy('position', 'asc')
    assert.deepEqual(
      persisted.map((point) => [point.position, point.latitude, point.longitude]),
      TRIANGLE.map((point, position) => [position, point.latitude, point.longitude]),
    )
  })

  test('trims the submitted name before storing it', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: '  South Shed  ', footprint: { points: TRIANGLE } })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'South Shed')
  })

  test('rejects a name already used by another warehouse, whatever its case or lifecycle', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const existing = await WarehouseFactory.merge({ name: 'North Shed' }).create()
    await addFootprint(existing.id)

    for (const name of ['north shed', '  NORTH SHED  ']) {
      const response = await client
        .post('/api/v1/warehouses')
        .loginAs(admin)
        .json({ name, footprint: { points: TRIANGLE } })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_NAME_CONFLICT')
    }

    assert.equal((await Warehouse.query()).length, 1)
  })

  test('rejects a name already used by an archived warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const archived = await WarehouseFactory.apply('archived')
      .merge({ name: 'Old Grain Store' })
      .create()
    await addFootprint(archived.id)

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: 'Old Grain Store', footprint: { points: TRIANGLE } })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NAME_CONFLICT')
    assert.equal((await Warehouse.query()).length, 1)
  })

  test('accepts a name already used by another site reference kind', async ({ assert, client }) => {
    const admin = await administrator()
    await DockFactory.merge({ name: 'Shared Name' }).create()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: 'Shared Name', footprint: { points: TRIANGLE } })

    response.assertStatus(201)
    assert.equal(response.body().data.name, 'Shared Name')
  })

  test('rejects a blank name', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: '   ', footprint: { points: TRIANGLE } })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'name')
    assert.equal((await Warehouse.query()).length, 0)
  })

  test('rejects a footprint with fewer than three points', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({ name: 'Too Small', footprint: { points: TRIANGLE.slice(0, 2) } })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal(response.body().error.details[0].field, 'footprint.points')
    assert.equal((await Warehouse.query()).length, 0)
  })

  test('rejects a coordinate outside its legal range', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({
        name: 'Off World',
        footprint: { points: [{ latitude: 91, longitude: 0 }, ...TRIANGLE.slice(1)] },
      })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    assert.equal((await Warehouse.query()).length, 0)
  })

  test('rejects a self-crossing outline without leaving anything behind', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({
        name: 'Bow Tie',
        footprint: {
          points: [
            { latitude: 0, longitude: 0 },
            { latitude: 2, longitude: 2 },
            { latitude: 0, longitude: 2 },
            { latitude: 2, longitude: 0 },
          ],
        },
      })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_INVALID_FOOTPRINT')
    assert.equal((await Warehouse.query()).length, 0)
    assert.equal((await WarehouseFootprintPoint.query()).length, 0)
  })

  test('rejects duplicate consecutive boundary points', async ({ assert, client }) => {
    const admin = await administrator()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(admin)
      .json({
        name: 'Doubled Point',
        footprint: { points: [TRIANGLE[0], TRIANGLE[0], TRIANGLE[1]] },
      })

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_INVALID_FOOTPRINT')
    assert.equal((await Warehouse.query()).length, 0)
  })

  test('rejects unauthenticated creation', async ({ assert, client }) => {
    const response = await client
      .post('/api/v1/warehouses')
      .json({ name: 'Anonymous Shed', footprint: { points: TRIANGLE } })

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
    assert.equal((await Warehouse.query()).length, 0)
  })

  test('rejects an active user without warehouse management permission', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client
      .post('/api/v1/warehouses')
      .loginAs(observer)
      .json({ name: 'Observer Shed', footprint: { points: TRIANGLE } })

    response.assertStatus(403)
    assert.equal((await Warehouse.query()).length, 0)
  })
})
