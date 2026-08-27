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

const FOOTPRINT = [
  { latitude: 49.4938, longitude: 0.1077 },
  { latitude: 49.4938, longitude: 0.1092 },
  { latitude: 49.4929, longitude: 0.1088 },
]

const INSIDE = { latitude: 49.4935, longitude: 0.1085 }
const UNKNOWN_ID = '018f80c1-1c40-7d21-9a2e-6b4f0d9d2f99'
const URL = '/api/v1/warehouse-doors/archive'

/** Marks exactly the given door ids as currently in use, so one door of a selection can block
 * without blocking its siblings. */
class SelectiveUsageChecker extends SiteReferenceUsageChecker {
  constructor(private readonly usedIds: string[]) {
    super()
  }

  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    if (input.referenceType !== 'WAREHOUSE_DOOR') {
      return Promise.resolve(new Set<string>())
    }

    return Promise.resolve(new Set(input.referenceIds.filter((id) => this.usedIds.includes(id))))
  }
}

const administrator = () => UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()

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

const door = (warehouseId: string, name: string, ...states: string[]) =>
  states
    .reduce(
      (current, state) => current.apply(state as never),
      WarehouseDoorFactory as ReturnType<typeof WarehouseDoorFactory.apply>,
    )
    .merge({ warehouseId, name, ...INSIDE })
    .create()

test.group('Warehouse door bulk archival endpoint', (group) => {
  group.each.setup(async () => {
    await WarehouseDoor.query().delete()
    await Warehouse.query().delete()
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('rejects unauthenticated and unauthorized submissions', async ({ assert, client }) => {
    const containing = await warehouse()
    const target = await door(containing.id, 'Door 1')

    const anonymous = await client.post(URL).json({ ids: [target.id] })
    anonymous.assertStatus(401)

    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const refused = await client
      .post(URL)
      .loginAs(observer)
      .json({ ids: [target.id] })
    refused.assertStatus(403)

    assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('archives the eligible doors and reports each one it left unchanged', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const first = await door(containing.id, 'Door 1')
    const second = await door(containing.id, 'Door 2')
    const held = await door(containing.id, 'Door 3')
    const already = await door(containing.id, 'Door 4', 'archived')
    app.container.swap(SiteReferenceUsageChecker, () => new SelectiveUsageChecker([held.id]))

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [first.id, held.id, already.id, UNKNOWN_ID, second.id], comment: 'Row closed' })

    response.assertStatus(200)
    const body = response.body().data as {
      updatedDoors: Array<{ id: string; status: string; archiveComment: string }>
      blockedDoors: Array<{ id: string; name?: string; reason: string }>
    }

    // Submission order, eligible doors only.
    assert.deepEqual(
      body.updatedDoors.map((entry) => entry.id),
      [first.id, second.id],
    )
    assert.deepEqual(body.blockedDoors, [
      { id: held.id, name: 'Door 3', reason: 'IN_USE' },
      { id: already.id, name: 'Door 4', reason: 'ALREADY_ARCHIVED' },
      { id: UNKNOWN_ID, reason: 'NOT_FOUND' },
    ])
    assert.equal((await WarehouseDoor.findOrFail(held.id)).status, 'AVAILABLE')
  })

  test('gives every door of one submission the same archive metadata', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const first = await door(containing.id, 'Door 1')
    const second = await door(containing.id, 'Door 2')

    await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [first.id, second.id], comment: '  North side condemned  ' })

    const archived = await WarehouseDoor.query().whereIn('id', [first.id, second.id])
    assert.lengthOf(archived, 2)
    for (const entry of archived) {
      assert.equal(entry.status, 'ARCHIVED')
      assert.equal(entry.archiveComment, 'North side condemned')
      assert.equal(entry.archivedByUserId, admin.id)
      assert.isFalse(entry.archivedWithWarehouse)
    }
    assert.equal(archived[0].archivedAt?.toISO(), archived[1].archivedAt?.toISO())
  })

  test('archives nothing and reports every reason when the whole selection is blocked', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const held = await door(containing.id, 'Door 1')
    const already = await door(containing.id, 'Door 2', 'archived')
    app.container.swap(SiteReferenceUsageChecker, () => new SelectiveUsageChecker([held.id]))

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [held.id, already.id, UNKNOWN_ID] })

    response.assertStatus(200)
    const body = response.body().data
    assert.isEmpty(body.updatedDoors)
    assert.lengthOf(body.blockedDoors, 3)
    assert.equal((await WarehouseDoor.findOrFail(held.id)).status, 'AVAILABLE')
  })

  test('accepts a submission spanning two warehouses, each door answering for its own', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const first = await warehouse()
    const second = await warehouse()
    const inFirst = await door(first.id, 'Door 1')
    const inSecond = await door(second.id, 'Door 1')

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [inFirst.id, inSecond.id] })

    response.assertStatus(200)
    assert.lengthOf(response.body().data.updatedDoors, 2)
    assert.equal((await WarehouseDoor.findOrFail(inFirst.id)).status, 'ARCHIVED')
    assert.equal((await WarehouseDoor.findOrFail(inSecond.id)).status, 'ARCHIVED')
  })

  test('rejects an empty, duplicated, or malformed selection before anything is read', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Door 1')

    for (const ids of [[], [target.id, target.id], ['not-a-uuid']]) {
      const response = await client.post(URL).loginAs(admin).json({ ids })

      response.assertStatus(422)
      assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
    }
  })

  test('rejects a comment longer than the lifecycle limit, archiving nothing', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse()
    const target = await door(containing.id, 'Door 1')

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [target.id], comment: 'x'.repeat(1001) })

    response.assertStatus(422)
    assert.equal((await WarehouseDoor.findOrFail(target.id)).status, 'AVAILABLE')
  })

  test('refuses a door of an archived warehouse, archiving its eligible siblings', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const closed = await warehouse('archived')
    const open = await warehouse()
    // Unreachable from the interface — the cascade archives every available door — so it is built
    // directly here, exactly as the single-door path's own guard is proven.
    const stranded = await door(closed.id, 'Stranded door')
    const eligible = await door(open.id, 'Door 1')

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [stranded.id, eligible.id], comment: 'Row closed' })

    response.assertStatus(200)
    assert.deepEqual(response.body().data.blockedDoors, [
      { id: stranded.id, name: 'Stranded door', reason: 'WAREHOUSE_ARCHIVED' },
    ])
    assert.equal((await WarehouseDoor.findOrFail(stranded.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(eligible.id)).status, 'ARCHIVED')
  })

  test('leaves a door archived with its warehouse untouched, provenance included', async ({
    assert,
    client,
  }) => {
    const admin = await administrator()
    const containing = await warehouse('archived')
    const cascaded = await door(containing.id, 'Door 1', 'archivedWithWarehouse')

    const response = await client
      .post(URL)
      .loginAs(admin)
      .json({ ids: [cascaded.id], comment: 'Retry' })

    response.assertStatus(200)
    assert.deepEqual(response.body().data.blockedDoors, [
      { id: cascaded.id, name: 'Door 1', reason: 'ALREADY_ARCHIVED' },
    ])
    const persisted = await WarehouseDoor.findOrFail(cascaded.id)
    assert.isTrue(persisted.archivedWithWarehouse)
    assert.notEqual(persisted.archiveComment, 'Retry')
  })
})
