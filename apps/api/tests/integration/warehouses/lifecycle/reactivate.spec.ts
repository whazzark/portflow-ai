import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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

type ReactivateBody = {
  warehouse: {
    id: string
    name: string
    status: string
    archivedAt: string | null
    archiveComment: string | null
    reactivatedAt: string | null
    reactivatedByUserId: string | null
    reactivationComment: string | null
    footprint: { points: unknown[] }
    doors: Array<{
      name: string
      status: string
      archivedAt: string | null
      archiveComment: string | null
      archivedWithWarehouse: boolean
      reactivatedAt: string | null
      reactivationComment: string | null
    }>
  }
  reactivatedDoorCount: number
}

const bodyOf = (response: { body(): unknown }) => (response.body() as { data: ReactivateBody }).data

test.group('Warehouse reactivation endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
  })

  test('rejects unauthenticated reactivation', async ({ assert, client }) => {
    const target = await warehouse('North Shed', 'archived')

    const response = await client.post(`/api/v1/warehouses/${target.id}/reactivate`).json({})

    response.assertStatus(401)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('reactivates an archived warehouse and restores exactly its cascaded doors', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const archivedAt = DateTime.now().minus({ days: 3 })
    const target = await warehouse('Socomac', 'archived')
    await target.merge({ archivedAt, archiveComment: 'Works' }).save()
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({
        warehouseId: target.id,
        name: 'Porte Quai',
        archivedAt,
        archiveComment: 'Works',
      })
      .create()
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'Porte Historique' })
      .create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'Zone reopened' })

    response.assertStatus(200)
    const body = bodyOf(response)
    assert.equal(body.warehouse.status, 'AVAILABLE')
    assert.equal(body.warehouse.name, 'Socomac')
    assert.equal(body.warehouse.reactivationComment, 'Zone reopened')
    assert.equal(body.warehouse.reactivatedByUserId, admin.id)
    assert.lengthOf(body.warehouse.footprint.points, 3)
    assert.equal(body.reactivatedDoorCount, 1)

    // The archive context stays readable beside the new reactivation context.
    assert.isNotNull(body.warehouse.archivedAt)
    assert.equal(body.warehouse.archiveComment, 'Works')

    const restored = body.warehouse.doors.find((door) => door.name === 'Porte Quai')
    assert.equal(restored?.status, 'AVAILABLE')
    assert.isFalse(restored?.archivedWithWarehouse)
    assert.equal(restored?.reactivatedAt, body.warehouse.reactivatedAt)
    assert.equal(restored?.reactivationComment, 'Zone reopened')
    assert.isNotNull(restored?.archivedAt)

    const untouched = body.warehouse.doors.find((door) => door.name === 'Porte Historique')
    assert.equal(untouched?.status, 'ARCHIVED')
    assert.isNull(untouched?.reactivatedAt)
  })

  test('records no comment when the supplied one is whitespace only', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Blank Shed', 'archived')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: '   ' })

    response.assertStatus(200)
    assert.isNull(bodyOf(response).warehouse.reactivationComment)
  })

  test('denies reactivation to an active user without warehouse administration rights', async ({
    assert,
    client,
  }) => {
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const target = await warehouse('Observed Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: target.id, name: 'Watched door' })
      .create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(observer)
      .json({})

    response.assertStatus(403)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
    assert.isTrue(
      (await WarehouseDoor.query().where('warehouseId', target.id)).every(
        (door) => door.status === 'ARCHIVED',
      ),
    )
  })

  test('denies reactivation to a user whose access is not active', async ({ assert, client }) => {
    const suspended = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_ADMIN' })
      .create()
    const target = await warehouse('Suspended Access Shed', 'archived')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(suspended)
      .json({})

    assert.isAbove(response.status(), 399)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
  })

  test('refuses a warehouse that does not exist without disclosing others', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const other = await warehouse('Untouched Shed', 'archived')

    const response = await client
      .post('/api/v1/warehouses/00000000-0000-4000-8000-000000000000/reactivate')
      .loginAs(admin)
      .json({})

    response.assertStatus(404)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_NOT_FOUND')
    assert.equal((await Warehouse.findOrFail(other.id)).status, 'ARCHIVED')
  })

  test('refuses a warehouse that is already available', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Already Open')
    await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: target.id, name: 'Solo door' })
      .create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(admin)
      .json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ALREADY_AVAILABLE')
    // A refused reactivation must not restore doors as a side-effect.
    const [door] = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.equal(door.status, 'ARCHIVED')
  })

  test('rejects a reactivation comment longer than the lifecycle limit', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Verbose Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: target.id, name: 'Quiet door' })
      .create()

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await Warehouse.findOrFail(target.id)).status, 'ARCHIVED')
    const [door] = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.equal(door.status, 'ARCHIVED')
  })

  test('accepts a reactivation comment at exactly the lifecycle limit', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Wordy Shed', 'archived')

    const response = await client
      .post(`/api/v1/warehouses/${target.id}/reactivate`)
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1000) })

    response.assertStatus(200)
    assert.lengthOf(bodyOf(response).warehouse.reactivationComment ?? '', 1000)
  })

  /**
   * Two submissions racing over the same warehouse: exactly one may record a reactivation, and the
   * loser must be refused as already available without overwriting the winner's context (FR-020).
   */
  test('records exactly one reactivation when two submissions race', async ({ assert, client }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Contested Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: target.id, name: 'Contested door' })
      .create()

    const responses = await Promise.all([
      client
        .post(`/api/v1/warehouses/${target.id}/reactivate`)
        .loginAs(admin)
        .json({ comment: 'first' }),
      client
        .post(`/api/v1/warehouses/${target.id}/reactivate`)
        .loginAs(admin)
        .json({ comment: 'second' }),
    ])

    const statuses = responses.map((response) => response.status()).sort()
    assert.deepEqual(statuses, [200, 409])

    const stored = await Warehouse.findOrFail(target.id)
    assert.equal(stored.status, 'AVAILABLE')
    const [door] = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.equal(door.status, 'AVAILABLE')
    assert.equal(
      door.reactivationComment,
      stored.reactivationComment,
      'the door carries the winning submission comment, not a mix of both',
    )
  })

  /**
   * The reason both directions take warehouse row locks before touching doors. Whichever wins, the
   * warehouse and its cascaded door must agree: a door available under an archived warehouse, or
   * archived under an available one, is an operationally invalid state, not a display glitch.
   */
  test('never leaves a warehouse and its cascaded door in disagreeing states', async ({
    assert,
    client,
  }) => {
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const target = await warehouse('Racing Shed', 'archived')
    await WarehouseDoorFactory.apply('archivedWithWarehouse')
      .merge({ warehouseId: target.id, name: 'Racing door' })
      .create()

    await Promise.all([
      client.post(`/api/v1/warehouses/${target.id}/reactivate`).loginAs(admin).json({}),
      client.post(`/api/v1/warehouses/${target.id}/archive`).loginAs(admin).json({}),
    ])

    const stored = await Warehouse.findOrFail(target.id)
    const [door] = await WarehouseDoor.query().where('warehouseId', target.id)
    assert.equal(
      door.status,
      stored.status,
      'the cascaded door ends on the same side of the lifecycle as its warehouse',
    )
  })
})
