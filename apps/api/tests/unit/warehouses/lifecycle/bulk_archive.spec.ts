import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
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
import ArchiveWarehousesUseCase from '#warehouses/archive/archive_warehouses_use_case'

class DoorsInUseChecker extends SiteReferenceUsageChecker {
  constructor(private readonly usedDoorIds: string[]) {
    super()
  }

  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    return Promise.resolve(
      new Set(input.referenceIds.filter((id) => this.usedDoorIds.includes(id))),
    )
  }
}

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

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

test.group('ArchiveWarehousesUseCase', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(SiteReferenceUsageChecker, () => app.container.make(UnusedChecker))
  })
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('archives eligible warehouses and reports each blocker in request order', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const eligible = await warehouse('Eligible Shed')
    const alreadyArchived = await warehouse('Retired Shed', 'archived')
    const held = await warehouse('Busy Shed')
    const heldDoor = await WarehouseDoorFactory.merge({
      warehouseId: held.id,
      name: 'Held door',
    }).create()
    app.container.swap(SiteReferenceUsageChecker, () => new DoorsInUseChecker([heldDoor.id]))

    const result = await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [eligible.id, alreadyArchived.id, held.id, UNKNOWN_ID],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: '  End-of-campaign cleanup  ',
    })

    assert.deepEqual(
      result.updatedWarehouses.map((record) => record.id),
      [eligible.id],
    )
    assert.deepEqual(
      result.blockedWarehouses.map((blocker) => [blocker.id, blocker.reason]),
      [
        [alreadyArchived.id, 'ALREADY_ARCHIVED'],
        [held.id, 'IN_USE'],
        [UNKNOWN_ID, 'NOT_FOUND'],
      ],
    )
    assert.equal(result.updatedWarehouses[0].archiveComment, 'End-of-campaign cleanup')
    assert.equal((await Warehouse.findOrFail(held.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(heldDoor.id)).status, 'AVAILABLE')
  })

  test('names every blocked warehouse except the one that does not exist', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alreadyArchived = await warehouse('Retired Shed', 'archived')

    const result = await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [alreadyArchived.id, UNKNOWN_ID],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(result.blockedWarehouses[0].name, 'Retired Shed')
    assert.isUndefined(result.blockedWarehouses[1].name)
  })

  test('gives every archived warehouse and cascaded door one identical context', async ({
    assert,
  }) => {
    const actor = await UserFactory.apply('active').create()
    const first = await warehouse('First Shed')
    const second = await warehouse('Second Shed')
    await WarehouseDoorFactory.merge({ warehouseId: first.id, name: 'First door' }).create()
    await WarehouseDoorFactory.merge({ warehouseId: second.id, name: 'Second door' }).create()

    const result = await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [first.id, second.id],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: 'One submission',
    })

    const archivedAt = result.updatedWarehouses[0].archivedAt?.toISO()
    assert.isTrue(
      result.updatedWarehouses.every(
        (record) =>
          record.archivedAt?.toISO() === archivedAt &&
          record.archivedByUserId === actor.id &&
          record.archiveComment === 'One submission',
      ),
    )

    const doors = await WarehouseDoor.query().whereIn('warehouseId', [first.id, second.id])
    assert.lengthOf(doors, 2)
    assert.isTrue(
      doors.every(
        (door) =>
          door.status === 'ARCHIVED' &&
          door.archiveComment === 'One submission' &&
          door.archivedAt?.toISO() === archivedAt,
      ),
    )
  })

  test('archives nothing when every warehouse in the selection is blocked', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alreadyArchived = await warehouse('Retired Shed', 'archived')

    const result = await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [alreadyArchived.id, UNKNOWN_ID],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.isEmpty(result.updatedWarehouses)
    assert.lengthOf(result.blockedWarehouses, 2)
  })

  test('takes over an already archived door of an eligible warehouse', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const other = await UserFactory.apply('active').create()
    const target = await warehouse('Mixed Shed')
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Live door' }).create()
    const preexisting = await WarehouseDoorFactory.apply('archived')
      .merge({
        warehouseId: target.id,
        name: 'Retired door',
        archivedByUserId: other.id,
        archiveComment: 'Retired on its own',
      })
      .create()

    await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [target.id],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: 'Bulk cleanup',
    })

    const taken = await WarehouseDoor.findOrFail(preexisting.id)
    assert.equal(taken.archiveComment, 'Bulk cleanup')
    assert.equal(taken.archivedByUserId, actor.id)
  })

  test('records nothing at all when the submission fails part-way through', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const first = await warehouse('First Shed')
    const second = await warehouse('Second Shed')
    await WarehouseDoorFactory.merge({ warehouseId: first.id, name: 'First door' }).create()
    // A checker that throws mid-transaction stands in for any failure after the locks are taken.
    app.container.swap(
      SiteReferenceUsageChecker,
      () =>
        ({
          findUsedByPlannedOrActiveDischarge: () => Promise.reject(new Error('usage store down')),
        }) as unknown as SiteReferenceUsageChecker,
    )

    await assert.rejects(
      async () =>
        (await app.container.make(ArchiveWarehousesUseCase)).handle({
          ids: [first.id, second.id],
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
          comment: null,
        }),
      /usage store down/,
    )

    assert.equal((await Warehouse.findOrFail(first.id)).status, 'AVAILABLE')
    assert.equal((await Warehouse.findOrFail(second.id)).status, 'AVAILABLE')
    assert.isTrue(
      (await WarehouseDoor.query().where('warehouseId', first.id)).every(
        (door) => door.status === 'AVAILABLE',
      ),
    )
  })

  test('archives an empty-eligible submission without touching anything', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const alreadyArchived = await warehouse('Retired Shed', 'archived')

    const result = await (await app.container.make(ArchiveWarehousesUseCase)).handle({
      ids: [alreadyArchived.id],
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.isEmpty(result.updatedWarehouses)
  })
})
