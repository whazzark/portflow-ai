import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'

import { CustomerFactory } from '#database/factories/customer_factory'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { FIXTURE_LIFECYCLE_ACTOR_EMAIL, MANAGED_FIXTURE_EXEMPLARS } from '#database/fixtures/index'
import Customer from '#models/customer'
import Dock from '#models/dock'
import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'
import User from '#models/user'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import WeighingArea from '#models/weighing_area'
import UserSeeder from '../../../database/seeders/01_user_seeder.ts'
import CustomerSeeder from '../../../database/seeders/02_customer_seeder.ts'
import TransportCompanySeeder from '../../../database/seeders/03_transport_company_seeder.ts'
import WarehouseDoorSeeder from '../../../database/seeders/07_warehouse_door_seeder.ts'
import { isPointInsideOrOnPolygon } from '../../support/geometry.ts'

type LifecycleRecord = {
  status: 'AVAILABLE' | 'ARCHIVED'
  archivedAt: { toMillis(): number } | null
  archivedByUserId: string | null
  archiveComment: string | null
  reactivatedAt: { toMillis(): number } | null
  reactivatedByUserId: string | null
  reactivationComment: string | null
}

test.group('Managed site-reference seeders', (group) => {
  group.each.setup(() => testUtils.db().truncate())

  test('initializes a coherent lifecycle foundation for all seven reference kinds', async ({
    assert,
  }) => {
    const startedAt = performance.now()

    await testUtils.db().seed()

    assert.isBelow(performance.now() - startedAt, 60_000)

    const actor = await User.query()
      .whereRaw('LOWER(email) = ?', [FIXTURE_LIFECYCLE_ACTOR_EMAIL])
      .firstOrFail()
    const customers = await Customer.all()
    const docks = await Dock.all()
    const weighingAreas = await WeighingArea.all()
    const warehouses = await Warehouse.query()
      .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
      .preload('doors')
    const doors = await WarehouseDoor.all()
    const companies = await TransportCompany.all()
    const trucks = await Truck.all()

    const lifecycleCollections: Array<{
      kind: string
      records: LifecycleRecord[]
    }> = [
      { kind: 'Customer', records: customers },
      { kind: 'Dock', records: docks },
      { kind: 'Weighing Area', records: weighingAreas },
      { kind: 'Warehouse', records: warehouses },
      { kind: 'Warehouse Door', records: doors },
      { kind: 'Transport Company', records: companies },
      { kind: 'Truck', records: trucks },
    ]

    for (const { kind, records } of lifecycleCollections) {
      assert.isNotEmpty(records, `${kind} should contain managed records`)
      assert.exists(
        records.find(
          (record) =>
            record.status === 'AVAILABLE' &&
            record.archivedAt === null &&
            record.reactivatedAt === null,
        ),
        `${kind} should contain an available scenario`,
      )
      assert.exists(
        records.find(
          (record) =>
            record.status === 'ARCHIVED' &&
            record.archivedAt !== null &&
            record.archiveComment !== null,
        ),
        `${kind} should contain an archived scenario`,
      )
      assert.exists(
        records.find(
          (record) =>
            record.status === 'AVAILABLE' &&
            record.archivedAt !== null &&
            record.reactivatedAt !== null &&
            record.archivedAt.toMillis() < record.reactivatedAt.toMillis() &&
            record.archiveComment !== null &&
            record.reactivationComment !== null,
        ),
        `${kind} should contain a previously reactivated scenario`,
      )
    }

    const archivedWarehouse = warehouses.find(
      (warehouse) => warehouse.name === MANAGED_FIXTURE_EXEMPLARS.warehouses.archived,
    )
    const reactivatedDoor = await WarehouseDoor.query()
      .whereRaw('LOWER(name) = ?', [
        MANAGED_FIXTURE_EXEMPLARS.warehouseDoors.reactivated.name.toLowerCase(),
      ])
      .firstOrFail()

    assert.equal(archivedWarehouse?.archivedByUserId, actor.id)
    assert.isTrue(archivedWarehouse?.doors.every((door) => door.status === 'ARCHIVED') ?? false)
    assert.equal(reactivatedDoor.archivedByUserId, actor.id)
    assert.equal(reactivatedDoor.reactivatedByUserId, actor.id)

    for (const dock of docks) {
      assert.isAtLeast(dock.latitude, -90)
      assert.isAtMost(dock.latitude, 90)
      assert.isAtLeast(dock.longitude, -180)
      assert.isAtMost(dock.longitude, 180)
    }

    for (const area of weighingAreas) {
      assert.isAtLeast(area.latitude, -90)
      assert.isAtMost(area.latitude, 90)
      assert.isAtLeast(area.longitude, -180)
      assert.isAtMost(area.longitude, 180)
    }

    for (const warehouse of warehouses) {
      const footprint = warehouse.footprintPoints.map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      }))

      assert.isAtLeast(footprint.length, 3)
      assert.deepEqual(
        warehouse.footprintPoints.map((point) => point.position),
        warehouse.footprintPoints.map((_, position) => position),
      )

      for (const door of warehouse.doors) {
        assert.isTrue(
          isPointInsideOrOnPolygon(
            { latitude: door.latitude, longitude: door.longitude },
            footprint,
          ),
          `${warehouse.name} / ${door.name} should be within its footprint`,
        )
      }
    }

    for (const truck of trucks) {
      const company = companies.find((candidate) => candidate.id === truck.transportCompanyId)

      assert.exists(company)
      assert.isAbove(Number(truck.capacityTonnes), 0)
      assert.isNotEmpty(truck.registration)
    }
  })

  test('converges managed drift without changing identities or unrelated records', async ({
    assert,
  }) => {
    await testUtils.db().seed()

    const customer = await Customer.query()
      .whereRaw('LOWER(code) = ?', [MANAGED_FIXTURE_EXEMPLARS.customers.available.toLowerCase()])
      .firstOrFail()
    const reactivatedCustomer = await Customer.query()
      .whereRaw('LOWER(code) = ?', [MANAGED_FIXTURE_EXEMPLARS.customers.reactivated.toLowerCase()])
      .firstOrFail()
    const company = await TransportCompany.query()
      .whereRaw('LOWER(name) = ?', [
        MANAGED_FIXTURE_EXEMPLARS.transportCompanies.available.toLowerCase(),
      ])
      .firstOrFail()
    const dock = await Dock.query()
      .whereRaw('LOWER(name) = ?', [MANAGED_FIXTURE_EXEMPLARS.docks.available.toLowerCase()])
      .firstOrFail()
    const weighingArea = await WeighingArea.query()
      .whereRaw('LOWER(name) = ?', [
        MANAGED_FIXTURE_EXEMPLARS.weighingAreas.reactivated.toLowerCase(),
      ])
      .firstOrFail()
    const warehouse = await Warehouse.query()
      .whereRaw('LOWER(name) = ?', [MANAGED_FIXTURE_EXEMPLARS.warehouses.reactivated.toLowerCase()])
      .firstOrFail()
    const door = await WarehouseDoor.query()
      .where('warehouseId', warehouse.id)
      .whereRaw('LOWER(name) = ?', [
        MANAGED_FIXTURE_EXEMPLARS.warehouseDoors.reactivated.name.toLowerCase(),
      ])
      .firstOrFail()
    const truck = await Truck.query()
      .whereILike('registration', MANAGED_FIXTURE_EXEMPLARS.trucks.reactivated)
      .firstOrFail()
    const originalIdentity = {
      customerId: customer.id,
      companyId: company.id,
      dockId: dock.id,
      weighingAreaId: weighingArea.id,
      warehouseId: warehouse.id,
      doorId: door.id,
      truckId: truck.id,
      truckCompanyId: truck.transportCompanyId,
      archivedAt: reactivatedCustomer.archivedAt?.toMillis(),
      reactivatedAt: reactivatedCustomer.reactivatedAt?.toMillis(),
    }

    const unrelatedCustomer = await CustomerFactory.merge({
      code: 'EXT-001',
      companyName: 'External Customer',
    }).create()
    const unrelatedCompany = await TransportCompanyFactory.merge({
      name: 'External Carrier',
    }).create()
    const unrelatedWarehouse = await WarehouseFactory.merge({ name: 'External Warehouse' }).create()
    await WarehouseFootprintPoint.createMany([
      { warehouseId: unrelatedWarehouse.id, position: 0, latitude: 45, longitude: -1 },
      { warehouseId: unrelatedWarehouse.id, position: 1, latitude: 45.1, longitude: -1 },
      { warehouseId: unrelatedWarehouse.id, position: 2, latitude: 45, longitude: -1.1 },
    ])
    const unrelatedDoor = await WarehouseDoorFactory.merge({
      warehouseId: unrelatedWarehouse.id,
      name: 'External Door',
      latitude: 45.02,
      longitude: -1.02,
    }).create()
    const countsBeforeRerun = {
      customers: (await Customer.all()).length,
      companies: (await TransportCompany.all()).length,
      docks: (await Dock.all()).length,
      weighingAreas: (await WeighingArea.all()).length,
      warehouses: (await Warehouse.all()).length,
      doors: (await WarehouseDoor.all()).length,
      trucks: (await Truck.all()).length,
    }

    customer.merge({ code: customer.code.toLowerCase(), companyName: 'Drifted customer' })
    company.name = company.name.toLowerCase()
    dock.merge({ name: dock.name.toLowerCase(), latitude: 45 })
    weighingArea.merge({ name: weighingArea.name.toLowerCase(), longitude: -1 })
    warehouse.name = warehouse.name.toLowerCase()
    door.merge({ name: door.name.toLowerCase(), longitude: -1.221 })
    truck.merge({
      registration: truck.registration.toLowerCase(),
      transportCompanyId: unrelatedCompany.id,
    })
    await Promise.all([
      customer.save(),
      company.save(),
      dock.save(),
      weighingArea.save(),
      warehouse.save(),
      door.save(),
      truck.save(),
    ])
    await WarehouseFootprintPoint.query()
      .where('warehouseId', warehouse.id)
      .where('position', 0)
      .update({ latitude: 40 })

    await testUtils.db().seed()

    const restoredCustomer = await Customer.findOrFail(originalIdentity.customerId)
    const restoredCompany = await TransportCompany.findOrFail(originalIdentity.companyId)
    const restoredDock = await Dock.findOrFail(originalIdentity.dockId)
    const restoredArea = await WeighingArea.findOrFail(originalIdentity.weighingAreaId)
    const restoredWarehouse = await Warehouse.findOrFail(originalIdentity.warehouseId)
    const restoredDoor = await WarehouseDoor.findOrFail(originalIdentity.doorId)
    const restoredTruck = await Truck.findOrFail(originalIdentity.truckId)
    const restoredReactivatedCustomer = await Customer.findOrFail(reactivatedCustomer.id)

    assert.equal(restoredCustomer.code, MANAGED_FIXTURE_EXEMPLARS.customers.available)
    assert.equal(restoredCustomer.companyName, 'Atlantique Céréales')
    assert.equal(restoredCompany.name, MANAGED_FIXTURE_EXEMPLARS.transportCompanies.available)
    assert.equal(restoredDock.name, MANAGED_FIXTURE_EXEMPLARS.docks.available)
    assert.equal(restoredDock.latitude, 46.16088)
    assert.equal(restoredArea.name, MANAGED_FIXTURE_EXEMPLARS.weighingAreas.reactivated)
    assert.equal(restoredArea.longitude, -1.231)
    assert.equal(restoredWarehouse.name, MANAGED_FIXTURE_EXEMPLARS.warehouses.reactivated)
    assert.equal(restoredDoor.name, MANAGED_FIXTURE_EXEMPLARS.warehouseDoors.reactivated.name)
    assert.equal(restoredDoor.warehouseId, restoredWarehouse.id)
    assert.equal(restoredDoor.longitude, -1.2222)
    assert.equal(restoredTruck.registration, MANAGED_FIXTURE_EXEMPLARS.trucks.reactivated)
    assert.equal(restoredTruck.transportCompanyId, originalIdentity.truckCompanyId)
    assert.equal(restoredReactivatedCustomer.archivedAt?.toMillis(), originalIdentity.archivedAt)
    assert.equal(
      restoredReactivatedCustomer.reactivatedAt?.toMillis(),
      originalIdentity.reactivatedAt,
    )
    assert.deepEqual(
      {
        customers: (await Customer.all()).length,
        companies: (await TransportCompany.all()).length,
        docks: (await Dock.all()).length,
        weighingAreas: (await WeighingArea.all()).length,
        warehouses: (await Warehouse.all()).length,
        doors: (await WarehouseDoor.all()).length,
        trucks: (await Truck.all()).length,
      },
      countsBeforeRerun,
    )
    assert.equal((await Customer.findOrFail(unrelatedCustomer.id)).companyName, 'External Customer')
    assert.equal((await WarehouseDoor.findOrFail(unrelatedDoor.id)).name, 'External Door')
    assert.equal(
      await WarehouseFootprintPoint.query()
        .where('warehouseId', unrelatedWarehouse.id)
        .count('* as total')
        .then((rows) => Number(rows[0].$extras.total)),
      3,
    )
  })

  test('fails explicitly when a declared door parent is missing', async ({ assert }) => {
    await testUtils.db().seed()
    const warehouse = await Warehouse.query()
      .whereRaw('LOWER(name) = ?', [MANAGED_FIXTURE_EXEMPLARS.warehouses.available.toLowerCase()])
      .firstOrFail()
    await WarehouseDoor.query().where('warehouseId', warehouse.id).delete()
    await warehouse.delete()

    await assert.rejects(
      () => new WarehouseDoorSeeder(db.connection()).run(),
      /fixture warehouse.*not found/i,
    )
  })

  test('requires a fresh database when a fixture business key has another UUID', async ({
    assert,
  }) => {
    await testUtils.db().seed()
    await TransportCompanyFactory.merge({
      name: MANAGED_FIXTURE_EXEMPLARS.transportCompanies.available.toLowerCase(),
    }).create()

    await assert.rejects(
      () => new TransportCompanySeeder(db.connection()).run(),
      /fixture UUID conflict.*migration:fresh/i,
    )
  })

  test('resumes a partial initialization without duplicating accepted records', async ({
    assert,
  }) => {
    await new UserSeeder(db.connection()).run()
    await new CustomerSeeder(db.connection()).run()

    await testUtils.db().seed()

    const matchingCustomers = await Customer.query().whereRaw('LOWER(code) = ?', [
      MANAGED_FIXTURE_EXEMPLARS.customers.available.toLowerCase(),
    ])
    assert.lengthOf(matchingCustomers, 1)
    assert.isNotEmpty(await Truck.all())
    assert.isNotEmpty(await WarehouseDoor.all())
  })
})
