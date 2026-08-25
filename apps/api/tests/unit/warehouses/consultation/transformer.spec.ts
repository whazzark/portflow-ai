import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import WarehouseTransformer from '#warehouses/shared/warehouse_transformer'

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

async function transformWarehouse(id: string) {
  const warehouse = await Warehouse.query()
    .where('id', id)
    .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
    .preload('doors', (query) => query.orderBy('name', 'asc'))
    .firstOrFail()

  return new WarehouseTransformer(warehouse).toObject()
}

test.group('Warehouse transformer lifecycle context', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('exposes the warehouse archive and reactivation context', async ({ assert }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archivedAt = DateTime.fromISO('2026-08-25T09:14:00.000Z')
    const warehouse = await WarehouseFactory.apply('archived')
      .merge({
        name: 'Old Grain Store',
        archivedAt,
        archivedByUserId: admin.id,
        archiveComment: 'Building repurposed',
      })
      .create()
    await WarehouseFootprintPoint.createMany(
      FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
    )

    const transformed = await transformWarehouse(warehouse.id)

    assert.equal(transformed.status, 'ARCHIVED')
    assert.equal(transformed.archiveComment, 'Building repurposed')
    assert.equal(transformed.archivedByUserId, admin.id)
    assert.isNotNull(transformed.archivedAt)
    assert.isNull(transformed.reactivatedAt)
    assert.isNull(transformed.reactivatedByUserId)
    assert.isNull(transformed.reactivationComment)
    assert.isNotNull(transformed.createdAt)
    assert.isNotNull(transformed.updatedAt)
    assert.lengthOf(transformed.footprint.points, 3)
  })

  test('exposes each door lifecycle context including its archive provenance', async ({
    assert,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const warehouse = await WarehouseFactory.apply('archived')
      .merge({ name: 'North Shed' })
      .create()
    await WarehouseFootprintPoint.createMany(
      FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
    )
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({
        warehouseId: warehouse.id,
        name: 'Cascaded door',
        archivedByUserId: admin.id,
        archiveComment: 'Building repurposed',
      })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: warehouse.id,
        name: 'Own door',
        archivedByUserId: admin.id,
        archiveComment: 'Door retired on its own',
      })
      .create()

    const transformed = await transformWarehouse(warehouse.id)
    const cascaded = transformed.doors.find((door) => door.name === 'Cascaded door')
    const own = transformed.doors.find((door) => door.name === 'Own door')

    assert.isTrue(cascaded?.archivedWithWarehouse)
    assert.equal(cascaded?.archiveComment, 'Building repurposed')
    assert.equal(cascaded?.archivedByUserId, admin.id)
    assert.isNotNull(cascaded?.archivedAt)
    assert.isFalse(own?.archivedWithWarehouse)
    assert.equal(own?.archiveComment, 'Door retired on its own')
  })

  test('reports available doors as carrying no archive provenance', async ({ assert }) => {
    const warehouse = await WarehouseFactory.merge({ name: 'Working Shed' }).create()
    await WarehouseFootprintPoint.createMany(
      FOOTPRINT.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
    )
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Live door' }).create()

    const transformed = await transformWarehouse(warehouse.id)

    assert.equal(transformed.doors[0].status, 'AVAILABLE')
    assert.isFalse(transformed.doors[0].archivedWithWarehouse)
    assert.isNull(transformed.doors[0].archivedAt)
    assert.isNull(transformed.doors[0].archiveComment)
  })
})
