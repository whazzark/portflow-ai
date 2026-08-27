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
 * (#210, #211). Archiving a warehouse cascades onto every one of its *available* doors; the two
 * lifecycles therefore meet on the same rows, and `archived_with_warehouse` is what keeps them
 * from overwriting each other.
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

  test('leaves a door retired on its own untouched when its warehouse is archived later', async ({
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
    const own = await WarehouseDoor.findOrFail(retired.id)

    await client
      .post(`/api/v1/warehouses/${warehouse.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Building repurposed' })

    const afterCascade = await WarehouseDoor.findOrFail(retired.id)
    // The cascade only takes AVAILABLE doors, so this one keeps its own context and provenance.
    assert.isFalse(afterCascade.archivedWithWarehouse)
    assert.equal(afterCascade.archiveComment, 'Walled up')
    assert.equal(afterCascade.archivedAt?.toISO(), own.archivedAt?.toISO())

    const cascaded = await WarehouseDoor.findOrFail(stillAvailable.id)
    assert.isTrue(cascaded.archivedWithWarehouse)
    assert.equal(cascaded.archiveComment, 'Building repurposed')
  })

  test('does not restore a door retired on its own when its warehouse is reactivated', async ({
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
    // Exactly the doors the cascade archived come back.
    assert.equal((await WarehouseDoor.findOrFail(cascaded.id)).status, 'AVAILABLE')
    const stillArchived = await WarehouseDoor.findOrFail(retired.id)
    assert.equal(stillArchived.status, 'ARCHIVED')
    assert.isFalse(stillArchived.archivedWithWarehouse)
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
    // The refusal overwrites nothing: one archival, one context, one provenance.
    assert.isTrue(persisted.archivedWithWarehouse)
    assert.equal(persisted.archivedAt?.toISO(), cascaded.archivedAt?.toISO())
    assert.equal(persisted.archiveComment, cascaded.archiveComment)
  })

  test('archives the warehouse of a door retired on its own without counting it twice', async ({
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
    // Only the door that was still available is reported by the cascade.
    assert.equal(response.body().data.archivedDoorCount, 1)
  })
})
