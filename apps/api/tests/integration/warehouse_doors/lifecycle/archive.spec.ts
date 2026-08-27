import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import SiteReferenceUsageChecker, {
  type SiteReferenceUsageInput,
} from '#site_references/shared/site_reference_usage_checker'
import UnusedChecker from '#site_references/shared/unused_checker'
import UsedChecker from '#site_references/shared/used_checker'

/**
 * Marks exactly the given door ids as currently in use, and records what it was asked — so a test
 * can block one door without blocking its siblings, and can prove this slice consults the shared
 * rule (`#240` FR-006) rather than defining a second one.
 */
class SelectiveUsageChecker extends SiteReferenceUsageChecker {
  readonly calls: SiteReferenceUsageInput[] = []

  constructor(private readonly usedIds: string[]) {
    super()
  }

  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    this.calls.push(input)

    if (input.referenceType !== 'WAREHOUSE_DOOR') {
      return Promise.resolve(new Set<string>())
    }

    return Promise.resolve(new Set(input.referenceIds.filter((id) => this.usedIds.includes(id))))
  }
}

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const INSIDE = { latitude: 49.4935, longitude: 0.1085 }

const administrator = (role: 'ORGANIZATION_ADMIN' | 'OPERATIONS_ADMIN' = 'OPERATIONS_ADMIN') =>
  UserFactory.apply('active').merge({ role }).create()

async function warehouse(...states: string[]) {
  const factory = states.reduce(
    (current, state) => current.apply(state as never),
    WarehouseFactory as ReturnType<typeof WarehouseFactory.apply>,
  )
  const record = await factory.create()
  await WarehouseFootprintPoint.createMany(
    FOOTPRINT.map((point, position) => ({ warehouseId: record.id, position, ...point })),
  )

  return record
}

const door = (warehouseId: string, name = 'Door 3', ...states: string[]) =>
  states
    .reduce(
      (current, state) => current.apply(state as never),
      WarehouseDoorFactory as ReturnType<typeof WarehouseDoorFactory.apply>,
    )
    .merge({ warehouseId, name, ...INSIDE })
    .create()

const url = (id: string) => `/api/v1/warehouse-doors/${id}/archive`

test.group('Warehouse door archival endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives an eligible door on its own', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id)
    // Read back rather than trusting the factory instance: SQLite (the test database, per ADR 0002)
    // does not round-trip the in-memory value's sub-second precision.
    const before = await WarehouseDoor.findOrFail(target.id)

    const response = await client
      .post(url(target.id))
      .loginAs(admin)
      .json({ comment: '  Walled up during the 2026 works  ' })

    response.assertStatus(200)
    const body = response.body().data as {
      id: string
      warehouseId: string
      name: string
      status: string
      latitude: number
      longitude: number
      archivedAt: string
      archivedByUserId: string
      archiveComment: string
      archivedWithWarehouse: boolean
    }

    assert.equal(body.id, target.id)
    assert.equal(body.status, 'ARCHIVED')
    assert.equal(body.archiveComment, 'Walled up during the 2026 works')
    assert.equal(body.archivedByUserId, admin.id)
    assert.isFalse(body.archivedWithWarehouse)
    assert.isNotNull(body.archivedAt)

    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.equal(persisted.status, 'ARCHIVED')
    assert.equal(persisted.archiveComment, 'Walled up during the 2026 works')
    assert.equal(persisted.archivedByUserId, admin.id)
    assert.isFalse(persisted.archivedWithWarehouse)
    // Preserved: only the lifecycle columns move.
    assert.equal(persisted.name, target.name)
    assert.equal(persisted.warehouseId, containing.id)
    assert.equal(persisted.latitude, INSIDE.latitude)
    assert.equal(persisted.longitude, INSIDE.longitude)
    assert.equal(persisted.createdAt.toISO(), before.createdAt.toISO())
  })

  test('records no comment when none, an empty one, or whitespace is supplied', async ({
    assert,
    client,
  }) => {
    const admin = await administrator('ORGANIZATION_ADMIN')
    const containing = await warehouse()

    for (const [index, payload] of [{}, { comment: '' }, { comment: '   ' }].entries()) {
      const target = await door(containing.id, `Blank comment ${index}`)

      const response = await client.post(url(target.id)).loginAs(admin).json(payload)

      response.assertStatus(200)
      assert.isNull(response.body().data.archiveComment)
      assert.isNull((await WarehouseDoor.findOrFail(target.id)).archiveComment)
    }
  })

  test('preserves an earlier reactivation context', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Reactivated door', 'reactivated')
    const before = await WarehouseDoor.findOrFail(target.id)

    const response = await client.post(url(target.id)).loginAs(admin).json({})

    response.assertStatus(200)
    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.equal(persisted.status, 'ARCHIVED')
    assert.isNotNull(persisted.reactivatedAt)
    assert.equal(persisted.reactivatedAt?.toISO(), before.reactivatedAt?.toISO())
  })

  test('leaves the containing warehouse untouched, even on its last available door', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const only = await door(containing.id, 'Only door')

    const response = await client.post(url(only.id)).loginAs(admin).json({})

    response.assertStatus(200)
    const persisted = await Warehouse.findOrFail(containing.id)
    assert.equal(persisted.status, 'AVAILABLE')
    assert.isNull(persisted.archivedAt)
    assert.isNull(persisted.archiveComment)
    assert.equal(persisted.name, containing.name)
    assert.lengthOf(
      await WarehouseDoor.query().where('warehouseId', containing.id).where('status', 'AVAILABLE'),
      0,
    )
  })

  test('keeps the archived name reserved within its warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Door 7')

    await client.post(url(target.id)).loginAs(admin).json({})

    const conflict = await client
      .post('/api/v1/warehouse-doors')
      .loginAs(admin)
      .json({ warehouseId: containing.id, name: 'door 7', ...INSIDE })

    conflict.assertStatus(409)
    assert.equal(conflict.body().error.code, 'E_WAREHOUSE_DOOR_NAME_CONFLICT')
  })

  test('refuses an archival by a user who is not authenticated', async ({ assert, client }) => {
    const containing = await warehouse()
    const target = await door(containing.id)

    const response = await client.post(url(target.id)).json({})

    response.assertStatus(401)
    assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('refuses an archival by every active role without administration rights', async ({
    assert,
    client,
  }) => {
    const containing = await warehouse()

    for (const role of ['OPERATIONS_LEAD', 'OBSERVER'] as const) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const target = await door(containing.id, `Door for ${role}`)

      const response = await client.post(url(target.id)).loginAs(user).json({})

      response.assertStatus(403)
      assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
    }
  })

  test('refuses an archival for an unknown or malformed door id', async ({ assert, client }) => {
    const admin = await administrator()

    for (const id of ['018f80c1-1c40-7d21-9a2e-6b4f0d9d2f11', 'not-a-uuid']) {
      const response = await client.post(url(id)).loginAs(admin).json({})

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_NOT_FOUND')
    }
  })

  test('refuses a second archival and leaves the recorded context untouched', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id)

    await client.post(url(target.id)).loginAs(admin).json({ comment: 'First' })
    const first = await WarehouseDoor.findOrFail(target.id)

    const response = await client.post(url(target.id)).loginAs(admin).json({ comment: 'Second' })

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_ALREADY_ARCHIVED')
    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.equal(persisted.archiveComment, 'First')
    assert.equal(persisted.archivedAt?.toISO(), first.archivedAt?.toISO())
  })

  test('refuses archiving a door already archived with its warehouse, keeping its provenance', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse('archived')
    const target = await door(containing.id, 'Cascaded door', 'archivedWithWarehouse')

    const response = await client.post(url(target.id)).loginAs(admin).json({ comment: 'Retry' })

    response.assertStatus(409)
    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.isTrue(persisted.archivedWithWarehouse)
    assert.notEqual(persisted.archiveComment, 'Retry')
  })

  test('refuses archiving a door of an archived warehouse', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse('archived')
    // Unreachable from the interface — the cascade archives every available door — so it is built
    // directly here to prove the guard holds for a crafted request.
    const target = await door(containing.id, 'Stranded door')

    const response = await client.post(url(target.id)).loginAs(admin).json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_ARCHIVED')
    assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('refuses archiving a door held by a planned or active discharge', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Assigned door')
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))

    const response = await client.post(url(target.id)).loginAs(admin).json({})

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_WAREHOUSE_DOOR_IN_USE')
    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.equal(persisted.status, 'AVAILABLE')
    assert.isNull(persisted.archivedAt)
  })

  test('rejects an archive comment longer than the lifecycle limit', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id)

    const response = await client
      .post(url(target.id))
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('blocks only the door the shared usage rule names, not its siblings', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const held = await door(containing.id, 'Held door')
    const free = await door(containing.id, 'Free door')
    const checker = new SelectiveUsageChecker([held.id])
    app.container.swap(SiteReferenceUsageChecker, () => checker)

    const refused = await client.post(url(held.id)).loginAs(admin).json({})
    const accepted = await client.post(url(free.id)).loginAs(admin).json({})

    refused.assertStatus(409)
    assert.equal(refused.body().error.code, 'E_WAREHOUSE_DOOR_IN_USE')
    accepted.assertStatus(200)
    assert.equal((await WarehouseDoor.findOrFail(held.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(free.id)).status, 'ARCHIVED')
  })

  test('asks the shared site-reference rule rather than defining a second one', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Consulted door')
    const checker = new SelectiveUsageChecker([])
    app.container.swap(SiteReferenceUsageChecker, () => checker)

    await client.post(url(target.id)).loginAs(admin).json({})

    // Exactly the submitted door, under the door reference type, and inside the write transaction:
    // whether a closed discharge, an ended assignment, or a shift membership without a current
    // product lot assignment counts is the shared rule's answer to give, not this slice's.
    assert.lengthOf(checker.calls, 1)
    assert.equal(checker.calls[0].referenceType, 'WAREHOUSE_DOOR')
    assert.deepEqual([...checker.calls[0].referenceIds], [target.id])
    assert.isDefined(checker.calls[0].client)
  })

  test('leaves no partial archive context behind any refusal', async ({ assert, client }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const inUse = await door(containing.id, 'Held door')
    const overLongComment = await door(containing.id, 'Long comment door')

    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UsedChecker))
    await client.post(url(inUse.id)).loginAs(admin).json({ comment: 'Refused' })
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
    await client
      .post(url(overLongComment.id))
      .loginAs(admin)
      .json({ comment: 'x'.repeat(1001) })

    for (const id of [inUse.id, overLongComment.id]) {
      const persisted = await WarehouseDoor.findOrFail(id)
      assert.equal(persisted.status, 'AVAILABLE')
      assert.isNull(persisted.archivedAt)
      assert.isNull(persisted.archivedByUserId)
      assert.isNull(persisted.archiveComment)
      assert.isFalse(persisted.archivedWithWarehouse)
    }
  })

  test('archives exactly once when the same door is submitted twice at once', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Raced door')

    const [first, second] = await Promise.all([
      client.post(url(target.id)).loginAs(admin).json({ comment: 'First' }),
      client.post(url(target.id)).loginAs(admin).json({ comment: 'Second' }),
    ])

    const statuses = [first.status(), second.status()].sort()
    assert.deepEqual(statuses, [200, 409])
    const persisted = await WarehouseDoor.findOrFail(target.id)
    assert.equal(persisted.status, 'ARCHIVED')
    // One recorded archival, one comment: the loser overwrote nothing.
    assert.oneOf(persisted.archiveComment, ['First', 'Second'])
  })
})
