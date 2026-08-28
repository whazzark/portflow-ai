import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { USER_ROLES } from '#models/user'
import WarehouseDoor from '#models/warehouse_door'

test.group('GET /api/v1/warehouse-doors/available', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
  })

  test('rejects unauthenticated access', async ({ assert, client }) => {
    const response = await client.get('/api/v1/warehouse-doors/available')

    response.assertStatus(401)
    assert.equal(response.body().error.code, 'E_UNAUTHORIZED_ACCESS')
  })

  test('returns only available doors under available warehouses', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const availableWarehouse = await WarehouseFactory.create()
    const archivedWarehouse = await WarehouseFactory.apply('archived').create()
    const available = await WarehouseDoorFactory.merge({
      warehouseId: availableWarehouse.id,
    }).create()
    const archivedDoor = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: availableWarehouse.id })
      .create()
    const archivedParentDoor = await WarehouseDoorFactory.merge({
      warehouseId: archivedWarehouse.id,
    }).create()

    const response = await client.get('/api/v1/warehouse-doors/available').loginAs(user)

    // Read back rather than trusting the factory instance: the persisted timestamp is what the
    // serializer echoes, and SQLite (the test database, per ADR 0002) does not round-trip the
    // in-memory value's precision.
    const persisted = await WarehouseDoor.findOrFail(available.id)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [
      {
        id: available.id,
        warehouseId: availableWarehouse.id,
        name: available.name,
        latitude: available.latitude,
        longitude: available.longitude,
        status: 'AVAILABLE',
        // The lifecycle context travels with every door the write contracts return, so the 200 from
        // an archival (#215) or a reactivation (#216) can state what it recorded. Null here, and
        // additive for this collection: no selector reads it.
        archivedAt: null,
        archivedByUserId: null,
        archiveComment: null,
        reactivatedAt: null,
        reactivatedByUserId: null,
        reactivationComment: null,
        createdAt: persisted.createdAt.toISO(),
        updatedAt: persisted.updatedAt.toISO(),
      },
    ])
    assert.notInclude(
      response.body().data.map((door: { id: string }) => door.id),
      archivedDoor.id,
    )
    assert.notInclude(
      response.body().data.map((door: { id: string }) => door.id),
      archivedParentDoor.id,
    )
  })

  test('returns an empty collection when no eligible door exists', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()
    const warehouse = await WarehouseFactory.apply('archived').create()
    await WarehouseDoorFactory.apply('archived').merge({ warehouseId: warehouse.id }).create()

    const response = await client.get('/api/v1/warehouse-doors/available').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [] })
  })

  test('allows every active role to consult the selector collection', async ({
    assert,
    client,
  }) => {
    const warehouse = await WarehouseFactory.create()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get('/api/v1/warehouse-doors/available').loginAs(user)

      response.assertStatus(200)
      assert.lengthOf(response.body().data, 1)
    }
  })
})
