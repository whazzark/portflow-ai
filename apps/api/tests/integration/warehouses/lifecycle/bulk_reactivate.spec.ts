import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

async function warehouse(name: string, ...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  const record = await factory.merge({ name }).create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: record.id, position, ...point })),
  )

  return record
}

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

type BulkBody = {
  updatedWarehouses: Array<{ id: string; name: string; status: string }>
  blockedWarehouses: Array<{ id: string; name?: string; reason: string }>
}

const bodyOf = (response: { body(): unknown }) => (response.body() as { data: BulkBody }).data

test.group('Warehouse bulk reactivation endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('rejects unauthenticated bulk reactivation', async ({ assert, client }) => {
    const target = await warehouse('North Shed', 'archived')

    const response = await client.post('/api/v1/warehouses/reactivate').json({ ids: [target.id] })

    response.assertStatus(401)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('denies bulk reactivation to an active non-administrator', async ({ assert, client }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const target = await warehouse('Observed Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(observer)
      .json({ ids: [target.id] })

    response.assertStatus(403)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  /**
   * The bulk route is declared before `/:id/reactivate`. Without that ordering, this call resolves
   * as a single reactivation of a warehouse whose id is the literal string "reactivate".
   */
  test('resolves the collection route rather than an :id of "reactivate"', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Routed Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [target.id] })

    response.assertStatus(200)
    assert.lengthOf(bodyOf(response).updatedWarehouses, 1)
  })

  test('reactivates the eligible warehouses and reports the rest individually', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const eligible = await warehouse('Eligible Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: eligible.id, name: 'Cascaded door' })
      .create()
    const available = await warehouse('Open Shed')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [eligible.id, available.id, UNKNOWN_ID], comment: 'Zone C reopened' })

    response.assertStatus(200)
    const body = bodyOf(response)
    assert.deepEqual(
      body.updatedWarehouses.map((entry) => entry.id),
      [eligible.id],
    )
    assert.deepEqual(body.blockedWarehouses, [
      { id: available.id, name: 'Open Shed', reason: 'ALREADY_AVAILABLE' },
      { id: UNKNOWN_ID, reason: 'NOT_FOUND' },
    ])

    const [door] = await WarehouseDoor.query().where('warehouseId', eligible.id)
    assert.equal(door.status, 'AVAILABLE')
    assert.equal(door.reactivationComment, 'Zone C reopened')
    assert.isFalse(door.archivedWithWarehouse)
  })

  test('rejects an empty selection before evaluating anything', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Bystander Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  // Deliberately distinct from a well-formed id that resolves to nothing, which is reported per
  // warehouse as NOT_FOUND rather than failing the whole submission.
  test('rejects a duplicated identifier rather than de-duplicating it', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Doubled Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [target.id, target.id] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('rejects a duplicate that differs only in letter case', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Cased Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [target.id.toLowerCase(), target.id.toUpperCase()] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('rejects a malformed identifier before anything changes', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Wellformed Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [target.id, 'not-a-uuid'] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('rejects an over-long comment with no warehouse or door changed', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Verbose Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: target.id, name: 'Quiet door' })
      .create()

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [target.id], comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
    const [door] = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.equal(door.status, 'ARCHIVED')
  })

  test('reports an entirely blocked selection without changing anything', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const available = await warehouse('Open Shed')

    const response = await client
      .post('/api/v1/warehouses/reactivate')
      .loginAs(admin)
      .json({ ids: [available.id, UNKNOWN_ID] })

    response.assertStatus(200)
    const body = bodyOf(response)
    assert.isEmpty(body.updatedWarehouses)
    assert.lengthOf(body.blockedWarehouses, 2)
    assert.isNull((await Warehouse.findOrFail(available.id)).reactivatedAt)
  })

  /**
   * Overlapping selections racing over the same warehouse. Whichever order they resolve in, the
   * warehouse must be reactivated exactly once and the loser must report it as already available
   * rather than recording a second reactivation over the first.
   */
  test('reactivates a contested warehouse exactly once across overlapping selections', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const contested = await warehouse('Contested Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: contested.id, name: 'Contested door' })
      .create()

    const responses = await Promise.all([
      client
        .post('/api/v1/warehouses/reactivate')
        .loginAs(admin)
        .json({ ids: [contested.id], comment: 'first' }),
      client
        .post('/api/v1/warehouses/reactivate')
        .loginAs(admin)
        .json({ ids: [contested.id], comment: 'second' }),
    ])

    const outcomes = responses.map((response) => bodyOf(response))
    const updated = outcomes.flatMap((outcome) => outcome.updatedWarehouses)
    const blocked = outcomes.flatMap((outcome) => outcome.blockedWarehouses)
    assert.lengthOf(updated, 1)
    assert.lengthOf(blocked, 1)
    assert.equal(blocked[0].reason, 'ALREADY_AVAILABLE')

    const stored = await Warehouse.findOrFail(contested.id)
    assert.equal(stored.status, 'AVAILABLE')
    const [door] = await WarehouseDoor.query().where('warehouseId', contested.id)
    assert.equal(door.status, 'AVAILABLE')
    assert.equal(door.reactivationComment, stored.reactivationComment)
  })
})
