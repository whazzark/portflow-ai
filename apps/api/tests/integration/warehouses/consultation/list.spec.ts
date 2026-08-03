import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

async function addFootprint(
  warehouseId: string,
  points: Array<{ latitude: number; longitude: number }>,
) {
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId, position, ...point })),
  )
}

test.group('Warehouse consultation', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

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
    const availableDoor = await WarehouseDoorFactory.merge({
      warehouseId: available.id,
      name: 'Door 1',
      latitude: 49.4938,
      longitude: 0.108,
    }).create()
    const archivedDoor = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: available.id, name: 'Door 2', latitude: 49.4937, longitude: 0.1081 })
      .create()

    const response = await client.get('/api/v1/warehouses').loginAs(user)
    response.assertStatus(200)
    const data = response.body().data as Array<{
      id: string
      name: string
      status: string
      footprint: { points: unknown[] }
      doors: Array<{
        id: string
        name: string
        status: string
        latitude: number
        longitude: number
      }>
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
    const returnedDoors = data.find((warehouse) => warehouse.id === available.id)?.doors
    assert.deepEqual(returnedDoors, [
      {
        id: availableDoor.id,
        name: availableDoor.name,
        status: 'AVAILABLE',
        latitude: availableDoor.latitude,
        longitude: availableDoor.longitude,
      },
      {
        id: archivedDoor.id,
        name: archivedDoor.name,
        status: 'ARCHIVED',
        latitude: archivedDoor.latitude,
        longitude: archivedDoor.longitude,
      },
    ])
  })

  test('does not expose a warehouse with an incomplete footprint', async ({ client }) => {
    const user = await UserFactory.apply('active').create()
    await WarehouseFactory.merge({ name: 'Incomplete Shed' }).create()

    const response = await client.get('/api/v1/warehouses').loginAs(user)
    response.assertStatus(500)
  })
})
