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

test.group('Warehouse archival endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated archival', async ({ assert, client }) => {
    const target = await warehouse('North Shed')

    const response = await client.post(`/api/v1/warehouses/${target.id}/archive`).json({})

    response.assertStatus(401)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('archives an eligible warehouse and returns it with its cascaded doors', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Socomac')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Porte Quai' }).create()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'Porte Historique' })
      .create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'Building repurposed' })

    response.assertStatus(200)
    const body = (response.body() as { data: unknown }).data as {
      warehouse: {
        status: string
        archiveComment: string
        archivedByUserId: string
        archivedAt: string
        name: string
        footprint: { points: unknown[] }
        doors: Array<{
          name: string
          status: string
          archivedWithWarehouse: boolean
          archiveComment: string | null
          archivedAt: string | null
        }>
      }
      archivedDoorCount: number
    }
    assert.equal(body.warehouse.status, 'ARCHIVED')
    assert.equal(body.warehouse.name, 'Socomac')
    assert.equal(body.warehouse.archiveComment, 'Building repurposed')
    assert.equal(body.warehouse.archivedByUserId, admin.id)
    assert.lengthOf(body.warehouse.footprint.points, 3)
    assert.equal(body.archivedDoorCount, 1)

    const cascaded = body.warehouse.doors.find((door) => door.name === 'Porte Quai')
    assert.isTrue(cascaded?.archivedWithWarehouse)
    assert.equal(cascaded?.status, 'ARCHIVED')
    assert.equal(cascaded?.archiveComment, 'Building repurposed')
    assert.equal(cascaded?.archivedAt, body.warehouse.archivedAt)

    const preexisting = body.warehouse.doors.find((door) => door.name === 'Porte Historique')
    assert.isFalse(preexisting?.archivedWithWarehouse)
  })

  test('archives with no comment when none is supplied', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await warehouse('Silent Shed')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(200)
    assert.isNull(
      (response.body() as { data: { warehouse: { archiveComment: string | null } } }).data.warehouse
        .archiveComment,
    )
  })

  test('denies an active user without warehouse administration rights', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const target = await warehouse('Observed Shed')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Watched door' }).create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(observer)
      .json({})

    response.assertStatus(403)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
    assert.isTrue(
      (await WarehouseDoor.query().where('warehouseId', target.id)).every(
        (door) => door.status === 'AVAILABLE',
      ),
    )
  })

  test('refuses a warehouse that does not exist without disclosing others', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const other = await warehouse('Untouched Shed')

    const response = await client
      .post('/api/v1/warehouses/00000000-0000-4000-8000-000000000000/archive')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
    assert.equal((await Warehouse.findOrFail(other.id)).status, 'AVAILABLE')
  })

  test('refuses a warehouse that is already archived', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Already Retired', 'archived')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ALREADY_ARCHIVED')
  })

  test('refuses a warehouse whose door is used by a planned or active discharge', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'ORGANIZATION_ADMIN' }).create()
    const target = await warehouse('Busy Shed')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Assigned door' }).create()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_IN_USE')
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
    assert.isTrue(
      (await WarehouseDoor.query().where('warehouseId', target.id)).every(
        (door) => door.status === 'AVAILABLE',
      ),
    )
  })

  test('rejects an archive comment longer than the lifecycle limit', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Verbose Shed')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Quiet door' }).create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'AVAILABLE')
    assert.isTrue(
      (await WarehouseDoor.query().where('warehouseId', target.id)).every(
        (door) => door.status === 'AVAILABLE',
      ),
    )
  })

  test('accepts a comment at exactly the lifecycle limit', async ({ client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Exact Shed')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/archive`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1000) })

    response.assertStatus(200)
  })

  test('collapses two near-simultaneous archival attempts into exactly one archival', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Contended Shed')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Contended door' }).create()

    const [first, second] = await Promise.all([
      client
        .post(`/api/v1/warehouses/${target.id}/archive`)
        .loginAs(admin)
        .json({ comment: 'first' }),
      client
        .post(`/api/v1/warehouses/${target.id}/archive`)
        .loginAs(admin)
        .json({ comment: 'second' }),
    ])

    assert.deepEqual([first.status(), second.status()].sort(), [200, 409])

    const winner = first.status() === 200 ? first : second
    const stored = await Warehouse.findOrFail(target.id)
    assert.equal(stored.status, 'ARCHIVED')
    assert.equal(stored.archiveComment, winner.body().data.warehouse.archiveComment)

    // The cascade is collapsed too: the door carries the winner's context, archived exactly once.
    const doors = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.lengthOf(doors, 1)
    assert.equal(doors[0].status, 'ARCHIVED')
    assert.isTrue(doors[0].archivedWithWarehouse)
    assert.equal(doors[0].archiveComment, stored.archiveComment)
  })
})
