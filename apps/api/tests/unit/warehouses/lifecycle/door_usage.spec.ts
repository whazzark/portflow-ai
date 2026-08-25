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
import ArchiveWarehouseUseCase from '#warehouses/archive/archive_warehouse_use_case'
import { WarehouseInUseException } from '#warehouses/shared/warehouse_exceptions'

/** Marks exactly the given door ids as currently in use, so a test can block one door of a
 * warehouse without blocking its siblings. */
class DoorsInUseChecker extends SiteReferenceUsageChecker {
  constructor(private readonly usedDoorIds: string[]) {
    super()
  }

  findUsedByPlannedOrActiveDischarge(input: SiteReferenceUsageInput) {
    if (input.referenceType !== 'WAREHOUSE_DOOR') {
      return Promise.resolve(new Set<string>())
    }

    return Promise.resolve(
      new Set(input.referenceIds.filter((id) => this.usedDoorIds.includes(id))),
    )
  }
}

// Sequenced rather than faked: `warehouses_name_unique` spans both lifecycle states, so a faker
// collision between two warehouses in one test would fail on the index, not on behaviour.
let nextWarehouseName = 0

async function warehouseWithFootprint() {
  nextWarehouseName += 1
  const warehouse = await WarehouseFactory.merge({
    name: `Warehouse ${nextWarehouseName}`,
  }).create()
  await WarehouseFootprintPoint.createMany(
    [1, 2, 3].map((step, position) => ({
      warehouseId: warehouse.id,
      position,
      latitude: 49.49 + step / 1000,
      longitude: 0.107 + step / 1000,
    })),
  )

  return warehouse
}

test.group('Warehouse archival door usage', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(SiteReferenceUsageChecker))

  test('refuses a warehouse when one of its doors is currently in use', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    const free = await WarehouseDoorFactory.merge({
      warehouseId: warehouse.id,
      name: 'Free door',
    }).create()
    const held = await WarehouseDoorFactory.merge({
      warehouseId: warehouse.id,
      name: 'Held door',
    }).create()
    app.container.swap(SiteReferenceUsageChecker, () => new DoorsInUseChecker([held.id]))

    await assert.rejects(
      async () =>
        (await app.container.make(ArchiveWarehouseUseCase)).handle({
          id: warehouse.id,
          archivedByUserId: actor.id,
          archivedAt: DateTime.now(),
          comment: null,
        }),
      WarehouseInUseException.message,
    )

    assert.equal((await Warehouse.findOrFail(warehouse.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(free.id)).status, 'AVAILABLE')
    assert.equal((await WarehouseDoor.findOrFail(held.id)).status, 'AVAILABLE')
  })

  test('does not let a door of another warehouse block this one', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const target = await warehouseWithFootprint()
    const neighbour = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: target.id, name: 'Target door' }).create()
    const neighbourDoor = await WarehouseDoorFactory.merge({
      warehouseId: neighbour.id,
      name: 'Neighbour door',
    }).create()
    app.container.swap(SiteReferenceUsageChecker, () => new DoorsInUseChecker([neighbourDoor.id]))

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: target.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(result.warehouse.status, 'ARCHIVED')
  })

  test('assesses usage through the shared warehouse-door rule only', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Historic door' }).create()
    const seen: string[] = []
    app.container.swap(SiteReferenceUsageChecker, () => {
      const checker = new UnusedChecker()
      const original = checker.findUsedByPlannedOrActiveDischarge.bind(checker)
      checker.findUsedByPlannedOrActiveDischarge = (input) => {
        seen.push(input.referenceType)
        return original(input)
      }

      return checker
    })

    await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    // Warehouses have no discharge relationship of their own; a second reference type here would
    // mean a rival definition of warehouse usage had been introduced.
    assert.deepEqual([...new Set(seen)], ['WAREHOUSE_DOOR'])
  })

  test('ignores a door whose only involvement has ended', async ({ assert }) => {
    const actor = await UserFactory.apply('active').create()
    const warehouse = await warehouseWithFootprint()
    await WarehouseDoorFactory.merge({ warehouseId: warehouse.id, name: 'Released door' }).create()
    // An ended assignment never reaches the used set (`#240` FR-009), so the checker reports none.
    app.container.swap(SiteReferenceUsageChecker, () => new DoorsInUseChecker([]))

    const result = await (await app.container.make(ArchiveWarehouseUseCase)).handle({
      id: warehouse.id,
      archivedByUserId: actor.id,
      archivedAt: DateTime.now(),
      comment: null,
    })

    assert.equal(result.warehouse.status, 'ARCHIVED')
    assert.equal(result.archivedDoorCount, 1)
  })
})
