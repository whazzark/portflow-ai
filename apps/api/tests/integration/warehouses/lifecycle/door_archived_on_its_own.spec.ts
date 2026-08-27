import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'

/**
 * The seam between archiving a door on its own (#215) and archiving or reactivating its warehouse
 * (#210, #211). Archiving a warehouse cascades onto every one of its doors without exception, so
 * the two lifecycles meet on the same rows and the building's archival wins: it takes over a door
 * retired beforehand, context and all, and gives it back when it is reactivated. What separates a
 * door archived on its own from one archived with its warehouse is therefore nothing recorded on
 * the door — it is the containing warehouse's own status.
 */
const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const INSIDE = { latitude: 49.4935, longitude: 0.1085 }

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function availableWarehouse() {
  const warehouse = await WarehouseFactory.create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const door = (warehouseId: string, name: string) =>
  WarehouseDoorFactory.merge({ warehouseId, name, ...INSIDE }).create()

test.group('Warehouse archival and a door archived on its own', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('takes over a door retired on its own when its warehouse is archived later', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const retired = await door(warehouse.id, 'Retired door')
    const stillAvailable = await door(warehouse.id, 'Working door')

    await client
      .post(`/api/v1/warehouse-doors/${retired.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Walled up' })

    await client
      .post(`/api/v1/warehouses/${warehouse.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Building repurposed' })

    // One archived warehouse, one archival: both doors carry the building's context, whatever
    // either of them was in beforehand.
    const takenOver = await WarehouseDoor.findOrFail(retired.id)
    const cascaded = await WarehouseDoor.findOrFail(stillAvailable.id)
    const building = await Warehouse.findOrFail(warehouse.id)
    assert.equal(takenOver.archiveComment, 'Building repurposed')
    assert.equal(takenOver.archivedAt?.toISO(), building.archivedAt?.toISO())
    assert.equal(cascaded.archiveComment, 'Building repurposed')
    assert.equal(cascaded.archivedAt?.toISO(), building.archivedAt?.toISO())
  })

  test('restores a door retired on its own when its warehouse is reactivated', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const retired = await door(warehouse.id, 'Retired door')
    const cascaded = await door(warehouse.id, 'Working door')

    await client.post(`/api/v1/warehouse-doors/${retired.id}/archive`).loginAs(admin).json({})
    await client.post(`/api/v1/warehouses/${warehouse.id}/archive`).loginAs(admin).json({})
    await client.post(`/api/v1/warehouses/${warehouse.id}/reactivate`).loginAs(admin).json({})

    assert.equal((await Warehouse.findOrFail(warehouse.id)).status, 'AVAILABLE')
    // The reactivation is the archival's mirror, so every door the building took comes back.
    assert.equal((await WarehouseDoor.findOrFail(cascaded.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(retired.id)).status, 'AVAILABLE')
  })

  test('refuses archiving a door on its own once its warehouse archived it', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const target = await door(warehouse.id, 'Cascaded door')

    await client.post(`/api/v1/warehouses/${warehouse.id}/archive`).loginAs(admin).json({})
    const cascaded = await WarehouseDoor.findOrFail(target.id)

    const response = await client
      .post(`/api/v1/warehouse-doors/${target.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'On its own' })

    response.assertStatus(409)
    const persisted = await WarehouseDoor.findOrFail(target.id)
    // The refusal overwrites nothing: an archived warehouse holds one archival, its own.
    assert.equal(persisted.archivedAt?.toISO(), cascaded.archivedAt?.toISO())
    assert.equal(persisted.archiveComment, cascaded.archiveComment)
  })

  test('counts every door of the warehouse it archives, retired ones included', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await availableWarehouse()
    const retired = await door(warehouse.id, 'Retired door')
    await door(warehouse.id, 'Working door')

    await client.post(`/api/v1/warehouse-doors/${retired.id}/archive`).loginAs(admin).json({})
    const response = await client
      .post(`/api/v1/warehouses/${warehouse.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    // Both doors are reported: the cascade wrote both, one of them for the second time.
    assert.equal(response.body().data.archivedDoorCount, 2)
  })
})
