import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

const SQUARE = [
  { latitude: 49.4929, longitude: 0.1077 },
  { latitude: 49.4929, longitude: 0.1092 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4938, longitude: 0.1077 },
]

/** Well inside SQUARE, and still inside every reshape below that is meant to succeed. */
const INSIDE_DOOR = { latitude: 49.4933, longitude: 0.1084 }

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

async function warehouseWith(
  points: Array<{ latitude: number; longitude: number }> = SQUARE,
  attributes: Partial<{ name: string; status: 'AVAILABLE' | 'ARCHIVED' }> = {},
) {
  const warehouse = await WarehouseFactory.merge({ name: 'North Shed', ...attributes }).create()
  await WarehouseFootprintPoint.createMany(
    points.map((point, position) => ({ warehouseId: warehouse.id, position, ...point })),
  )

  return warehouse
}

const storedPoints = (warehouseId: string) =>
  WarehouseFootprintPoint.query()
    .where('warehouse_id', warehouseId)
    .orderBy('position', 'asc')
    .then((rows) =>
      rows.map((row) => [row.position, row.latitude, row.longitude] as [number, number, number]),
    )

const asRows = (points: Array<{ latitude: number; longitude: number }>) =>
  points.map((point, position) => [position, point.latitude, point.longitude])

test.group('Warehouse update', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await WarehouseFootprintPoint.query().delete()
    await Warehouse.query().delete()
  })

  test('replaces the footprint with the submitted order and leaves nothing behind', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    const reshaped = SQUARE.slice(0, 3)

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'North Shed Renamed', footprint: { points: reshaped } })

    response.assertStatus(200)
    const updated = response.body().data
    assert.equal(updated.id, warehouse.id)
    assert.equal(updated.name, 'North Shed Renamed')
    assert.equal(updated.status, 'AVAILABLE')
    assert.deepEqual(updated.footprint.points, reshaped)
    assert.deepEqual(await storedPoints(warehouse.id), asRows(reshaped))
  })

  test('preserves identity, status, creation time, and lifecycle context', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    // Read back what was stored rather than what the factory held: the column keeps second
    // precision, so the in-memory instance is not the value an update has to preserve.
    const createdAt = (await Warehouse.findOrFail(warehouse.id)).createdAt.toMillis()

    await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed Shed' })

    const reloaded = await Warehouse.findOrFail(warehouse.id)
    assert.equal(reloaded.id, warehouse.id)
    assert.equal(reloaded.status, 'AVAILABLE')
    assert.equal(reloaded.createdAt.toMillis(), createdAt)
    assert.isNull(reloaded.archivedAt)
    assert.isNull(reloaded.archivedByUserId)
    assert.isNull(reloaded.reactivatedAt)
    assert.isAtLeast(reloaded.updatedAt.toMillis(), createdAt)
  })

  test('leaves the doors untouched', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    await WarehouseDoor.create({
      warehouseId: warehouse.id,
      name: 'North Door',
      status: 'AVAILABLE',
      ...INSIDE_DOOR,
    })

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed Shed' })

    response.assertStatus(200)
    assert.lengthOf(response.body().data.doors, 1)
    assert.equal(response.body().data.doors[0].name, 'North Door')

    const doors = await WarehouseDoor.query().where('warehouse_id', warehouse.id)
    assert.lengthOf(doors, 1)
    assert.equal(doors[0].latitude, INSIDE_DOOR.latitude)
    assert.equal(doors[0].longitude, INSIDE_DOOR.longitude)
  })

  test('accepts a name-only correction and a footprint-only correction', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const renamed = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'Only Renamed' })
    renamed.assertStatus(200)
    assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))

    const reshaped = SQUARE.slice(0, 3)
    const moved = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ footprint: { points: reshaped } })
    moved.assertStatus(200)
    assert.equal(moved.body().data.name, 'Only Renamed')
    assert.deepEqual(await storedPoints(warehouse.id), asRows(reshaped))
  })

  test('accepts a resubmission of the warehouse own current values', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'North Shed', footprint: { points: SQUARE } })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'North Shed')
    assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))
  })

  test('refuses a name already used by another warehouse, whatever its case or lifecycle', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    await warehouseWith(SQUARE, { name: 'South Shed' })
    await warehouseWith(SQUARE, { name: 'Retired Shed', status: 'ARCHIVED' })

    for (const name of ['South Shed', '  south shed  ', 'RETIRED SHED']) {
      const response = await client
        .patch(`/api/v1/warehouses/${warehouse.id}`)
        .loginAs(admin)
        .json({ name })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_NAME_CONFLICT')
      assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'North Shed')
    }
  })

  test('accepts a name already used by another kind of site reference', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    const { DockFactory } = await import('#database/factories/dock_factory')
    await DockFactory.merge({ name: 'Quay One' }).create()

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'Quay One' })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Quay One')
  })

  test('trims the submitted name before storing it', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: '  Trimmed Shed  ' })

    response.assertStatus(200)
    assert.equal(response.body().data.name, 'Trimmed Shed')
    assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'Trimmed Shed')
  })

  test('refuses structurally unacceptable payloads and leaves the footprint untouched', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const payloads = [
      {},
      { name: '   ' },
      { footprint: { points: SQUARE.slice(0, 2) } },
      { footprint: { points: [...SQUARE.slice(0, 2), { latitude: 91, longitude: 0.1 }] } },
    ]

    for (const payload of payloads) {
      const response = await client
        .patch(`/api/v1/warehouses/${warehouse.id}`)
        .loginAs(admin)
        .json(payload)

      response.assertStatus(422)
      assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))
    }
  })

  test('refuses an outline that crosses itself, repeats a point, or encloses no area', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const outlines = [
      // A bow-tie: the two non-adjacent edges cross.
      [
        { latitude: 49.4929, longitude: 0.1077 },
        { latitude: 49.4938, longitude: 0.1092 },
        { latitude: 49.4929, longitude: 0.1092 },
        { latitude: 49.4938, longitude: 0.1077 },
      ],
      // Two identical consecutive points.
      [
        { latitude: 49.4929, longitude: 0.1077 },
        { latitude: 49.4929, longitude: 0.1077 },
        { latitude: 49.4938, longitude: 0.1092 },
      ],
      // Three points on one line enclose nothing.
      [
        { latitude: 49.493, longitude: 0.108 },
        { latitude: 49.4931, longitude: 0.108 },
        { latitude: 49.4932, longitude: 0.108 },
      ],
    ]

    for (const points of outlines) {
      const response = await client
        .patch(`/api/v1/warehouses/${warehouse.id}`)
        .loginAs(admin)
        .json({ footprint: { points } })

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_INVALID_FOOTPRINT')
      assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))
    }
  })

  test('refuses a reshape that would leave a door outside, naming it', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    await WarehouseDoor.create({
      warehouseId: warehouse.id,
      name: 'Far Door',
      status: 'AVAILABLE',
      latitude: 49.4937,
      longitude: 0.1091,
    })

    // Half the square: the door at (49.4937, 0.1091) falls outside it.
    const shrunk = [
      { latitude: 49.4929, longitude: 0.1077 },
      { latitude: 49.4929, longitude: 0.1084 },
      { latitude: 49.4933, longitude: 0.1084 },
      { latitude: 49.4933, longitude: 0.1077 },
    ]

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ footprint: { points: shrunk } })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT')
    assert.include(response.body().error.message, 'Far Door')
    assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))
    assert.lengthOf(await WarehouseDoor.query().where('warehouse_id', warehouse.id), 1)
  })

  test('refuses a reshape that would leave an archived door outside', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    await WarehouseDoor.create({
      warehouseId: warehouse.id,
      name: 'Retired Door',
      status: 'ARCHIVED',
      latitude: 49.4937,
      longitude: 0.1091,
    })

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({
        footprint: {
          points: [
            { latitude: 49.4929, longitude: 0.1077 },
            { latitude: 49.4929, longitude: 0.1084 },
            { latitude: 49.4933, longitude: 0.1084 },
            { latitude: 49.4933, longitude: 0.1077 },
          ],
        },
      })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT')
    assert.include(response.body().error.message, 'Retired Door')
  })

  test('accepts a reshape leaving a door exactly on the resulting boundary', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    await WarehouseDoor.create({
      warehouseId: warehouse.id,
      name: 'Edge Door',
      status: 'AVAILABLE',
      latitude: 49.4929,
      longitude: 0.1084,
    })

    const reshaped = SQUARE.slice(0, 3)

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ footprint: { points: reshaped } })

    response.assertStatus(200)
    assert.deepEqual(await storedPoints(warehouse.id), asRows(reshaped))
  })

  test('reshapes a warehouse with no doors freely', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    const shrunk = [
      { latitude: 49.4929, longitude: 0.1077 },
      { latitude: 49.4929, longitude: 0.108 },
      { latitude: 49.493, longitude: 0.108 },
    ]

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ footprint: { points: shrunk } })

    response.assertStatus(200)
    assert.deepEqual(await storedPoints(warehouse.id), asRows(shrunk))
  })

  test('refuses an unauthenticated update', async ({ assert, client }) => {
    const warehouse = await warehouseWith()

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .json({ name: 'Renamed Shed' })

    assert.notEqual(response.status(), 200)
    assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'North Shed')
  })

  test('refuses an active user without warehouse management permission', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const warehouse = await warehouseWith()

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(observer)
      .json({ name: 'Renamed Shed' })

    response.assertStatus(403)
    assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'North Shed')
  })

  test('refuses an archived warehouse as read-only', async ({ assert, client }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith(SQUARE, { name: 'Retired Shed', status: 'ARCHIVED' })

    const response = await client
      .patch(`/api/v1/warehouses/${warehouse.id}`)
      .loginAs(admin)
      .json({ name: 'Renamed Shed' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ARCHIVED')
    assert.include(response.body().error.message, 'Reactivate')
    assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'Retired Shed')
  })

  test('refuses an unknown warehouse without disclosing the others', async ({ assert, client }) => {
    const admin = await administrator()
    await warehouseWith()

    const response = await client
      .patch('/api/v1/warehouses/99999999-9999-4999-8999-999999999999')
      .loginAs(admin)
      .json({ name: 'Renamed Shed' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
    assert.notInclude(JSON.stringify(response.body()), 'North Shed')
  })

  test('refuses a malformed identifier as an unknown warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    await warehouseWith()

    // The `uuid` column would otherwise make Postgres raise `22P02`, turning a mistyped URL into a
    // 500 where the route means "no such warehouse".
    const response = await client
      .patch('/api/v1/warehouses/not-a-uuid')
      .loginAs(admin)
      .json({ name: 'Renamed Shed' })

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
  })

  test('refuses a door moved outside between the read and the write', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()
    const door = await WarehouseDoor.create({
      warehouseId: warehouse.id,
      name: 'Moving Door',
      status: 'AVAILABLE',
      ...INSIDE_DOOR,
    })

    // The pre-flight read sees the door where it was; the write must see where it has moved to,
    // or it would store a footprint that no longer encloses it.
    const repository = await import('#warehouses/shared/repositories/lucid_warehouse_repository')
    const original = repository.default.prototype.findWithDoors
    repository.default.prototype.findWithDoors = async function patched(id: string) {
      const found = await original.call(this, id)
      await WarehouseDoor.query().where('id', door.id).update({ latitude: 49.6, longitude: 0.6 })
      return found
    }

    try {
      const response = await client
        .patch(`/api/v1/warehouses/${warehouse.id}`)
        .loginAs(admin)
        .json({ name: 'Renamed Shed', footprint: { points: SQUARE.slice(0, 3) } })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT')
      assert.include(response.body().error.message, 'Moving Door')
      // The refusal rolls the whole write back, name included.
      assert.deepEqual(await storedPoints(warehouse.id), asRows(SQUARE))
      assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'North Shed')
    } finally {
      repository.default.prototype.findWithDoors = original
    }
  })

  test('refuses a warehouse archived between the read and the write', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const warehouse = await warehouseWith()

    // The guarded write is the only thing standing between an in-flight correction and a warehouse
    // another administrator archived meanwhile.
    const repository = await import('#warehouses/shared/repositories/lucid_warehouse_repository')
    const original = repository.default.prototype.findWithDoors
    repository.default.prototype.findWithDoors = async function patched(id: string) {
      const found = await original.call(this, id)
      await Warehouse.query().where('id', id).update({ status: 'ARCHIVED' })
      return found
    }

    try {
      const response = await client
        .patch(`/api/v1/warehouses/${warehouse.id}`)
        .loginAs(admin)
        .json({ name: 'Renamed Shed' })

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_ARCHIVED')
      assert.equal((await Warehouse.findOrFail(warehouse.id)).name, 'North Shed')
    } finally {
      repository.default.prototype.findWithDoors = original
    }
  })
})
