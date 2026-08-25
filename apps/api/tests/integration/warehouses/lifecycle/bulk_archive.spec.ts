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
import UsedChecker from '#site_references/shared/used_checker'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

async function warehouse(name: string, ...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  const record = await factory.merge({ name }).create()
  await WarehouseFootprintPoint.createMany(
    [1, 2, 3].map((step, position) => ({
      warehouseId: record.id,
      position,
      latitude: 49.49 + step / 1000,
      longitude: 0.107 + step / 1000,
    })),
  )

  return record
}

type BulkBody = {
  data: {
    updatedWarehouses: Array<{ id: string; name: string; status: string; doors: unknown[] }>
    blockedWarehouses: Array<{ id: string; name?: string; reason: string }>
  }
}

test.group('Warehouse bulk archival endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('resolves /warehouses/archive to the bulk handler rather than :id', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Routed Shed')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [target.id] })

    response.assertStatus(200)
    // The `:id` handler would have answered 404 for the literal id "archive".
    assert.lengthOf((response.body() as BulkBody).data.updatedWarehouses, 1)
  })

  test('rejects unauthenticated bulk archival', async ({ assert, client }) => {
    const target = await warehouse('North Shed')

    const response = await client.post('/api/v1/warehouses/archive').json({ ids: [target.id] })

    response.assertStatus(401)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('denies bulk archival to an active non-administrator as a whole', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const first = await warehouse('First Shed')
    const second = await warehouse('Second Shed')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(observer)
      .json({ ids: [first.id, second.id] })

    response.assertStatus(403)
    assert.equal((await Warehouse.findOrFail(first.id)).status, 'AVAILABLE')
    assert.equal((await Warehouse.findOrFail(second.id)).status, 'AVAILABLE')
  })

  test('reports partial success with one specific reason per blocked warehouse', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const eligible = await warehouse('Eligible Shed')
    await WarehouseDoorFactory.merge({ warehouseId: eligible.id, name: 'Free door' }).create()
    const alreadyArchived = await warehouse('Retired Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [eligible.id, alreadyArchived.id, UNKNOWN_ID], comment: 'Cleanup' })

    response.assertStatus(200)
    const body = (response.body() as BulkBody).data
    assert.deepEqual(
      body.updatedWarehouses.map((record) => record.name),
      ['Eligible Shed'],
    )
    assert.deepEqual(
      body.blockedWarehouses.map((blocker) => blocker.reason),
      ['ALREADY_ARCHIVED', 'NOT_FOUND'],
    )
    const cascaded = await WarehouseDoor.query().where('warehouseId', eligible.id).firstOrFail()
    assert.equal(cascaded.status, 'ARCHIVED')
    assert.isTrue(cascaded.archivedWithWarehouse)
  })

  test('reports an all-blocked submission as an outcome rather than an error', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const held = await warehouse('Busy Shed')
    await WarehouseDoorFactory.merge({ warehouseId: held.id, name: 'Held door' }).create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [held.id, UNKNOWN_ID] })

    response.assertStatus(200)
    const body = (response.body() as BulkBody).data
    assert.isEmpty(body.updatedWarehouses)
    assert.deepEqual(
      body.blockedWarehouses.map((blocker) => blocker.reason),
      ['IN_USE', 'NOT_FOUND'],
    )
    assert.equal((await Warehouse.findOrFail(held.id)).status, 'AVAILABLE')
  })

  test('rejects an empty selection before anything changes', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const untouched = await warehouse('Untouched Shed')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(untouched.id)).status, 'AVAILABLE')
  })

  test('rejects a selection naming the same warehouse twice', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Duplicated Shed')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [target.id, target.id] })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('rejects a malformed identifier, distinctly from one that resolves to nothing', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Well-formed Shed')

    const malformed = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [target.id, 'not-a-uuid'] })

    malformed.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')

    const wellFormed = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [target.id, UNKNOWN_ID] })

    wellFormed.assertStatus(200)
    const body = (wellFormed.body() as BulkBody).data
    assert.lengthOf(body.updatedWarehouses, 1)
    assert.deepEqual(
      body.blockedWarehouses.map((blocker) => blocker.reason),
      ['NOT_FOUND'],
    )
  })

  test('rejects an over-long comment leaving the whole selection unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const first = await warehouse('First Shed')
    const second = await warehouse('Second Shed')

    const response = await client
      .post('/api/v1/warehouses/archive')
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(first.id)).status, 'AVAILABLE')
    assert.equal((await Warehouse.findOrFail(second.id)).status, 'AVAILABLE')
  })

  test('archives each shared warehouse exactly once across overlapping submissions', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const shared = await warehouse('Shared Shed')
    await WarehouseDoorFactory.merge({ warehouseId: shared.id, name: 'Shared door' }).create()
    const first = await warehouse('First Shed')
    const second = await warehouse('Second Shed')

    const [left, right] = await Promise.all([
      client
        .post('/api/v1/warehouses/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, first.id], comment: 'left' }),
      client
        .post('/api/v1/warehouses/archive')
        .loginAs(admin)
        .json({ ids: [shared.id, second.id], comment: 'right' }),
    ])

    left.assertStatus(200)
    right.assertStatus(200)
    const bodies = [left, right].map((response) => (response.body() as BulkBody).data)
    const archivedShared = bodies.filter((body) =>
      body.updatedWarehouses.some((record) => record.id === shared.id),
    )
    const blockedShared = bodies.filter((body) =>
      body.blockedWarehouses.some(
        (blocker) => blocker.id === shared.id && blocker.reason === 'ALREADY_ARCHIVED',
      ),
    )
    assert.lengthOf(archivedShared, 1)
    assert.lengthOf(blockedShared, 1)

    const stored = await Warehouse.findOrFail(shared.id)
    assert.equal(stored.status, 'ARCHIVED')
    const door = await WarehouseDoor.query().where('warehouseId', shared.id).firstOrFail()
    assert.equal(door.archiveComment, stored.archiveComment)
  })
})
