import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

async function addFootprint(
  warehouseId: string,
  points: Array<{ latitude: number; longitude: number }>,
) {
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId, position, ...point })),
  )
}

test.group('Warehouse consultation', () => {
  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/warehouses')
    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('lists mixed lifecycle warehouses with complete ordered footprints', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const available = await WarehouseFactory.merge({ name: 'North Shed' }).create()
    const archived = await WarehouseFactory.apply('archived')
      .merge({ name: 'Old Grain Store' })
      .create()
    await addFootprint(available.id, [
      { latitude: 49.4938, longitude: 0.1077 },
      { latitude: 49.4938, longitude: 0.1092 },
      { latitude: 49.4929, longitude: 0.1088 },
    ])
    await addFootprint(archived.id, [
      { latitude: 49.4918, longitude: 0.104 },
      { latitude: 49.4924, longitude: 0.1051 },
      { latitude: 49.4913, longitude: 0.1054 },
    ])

    const response = await client.get('/api/v1/warehouses').loginAs(user)
    response.assertStatus(200)
    const data = response.body().data as Array<{
      id: string
      name: string
      status: string
      footprint: { points: unknown[] }
    }>
    assert.deepEqual(
      data.map((warehouse) => warehouse.name),
      ['North Shed', 'Old Grain Store'],
    )
    assert.equal(
      data.find((warehouse) => warehouse.id === available.id)?.footprint.points.length,
      3,
    )
    assert.equal(data.find((warehouse) => warehouse.id === archived.id)?.status, 'ARCHIVED')
  })
})
