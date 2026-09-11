import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import {
  ShiftTruckFactory,
  ShiftWarehouseDoorFactory,
  ShiftWeighingAreaFactory,
} from '#database/factories/shift_resource_membership_factories'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import ShowDischargeUseCase from '#discharges/show/show_discharge_use_case'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

async function findDetail(id: string) {
  return (await app.container.make(DischargeRepository)).findDetail(id)
}

async function showDischarge(id: string) {
  return (await app.container.make(ShowDischargeUseCase)).handle({ id })
}

test.group('Discharge detail lookup', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('finds nothing for an unknown identity', async ({ assert }) => {
    assert.isNull(await findDetail(UNKNOWN_ID))
  })

  test('finds nothing for an identity that is not a UUID', async ({ assert }) => {
    assert.isNull(await findDetail('not-a-uuid'))
  })

  test('refuses an unknown or malformed identity as one not-found outcome', async ({ assert }) => {
    await assert.rejects(() => showDischarge(UNKNOWN_ID), DischargeNotFoundException)
    await assert.rejects(() => showDischarge('not-a-uuid'), DischargeNotFoundException)
  })

  test('returns a known discharge with its dock', async ({ assert }) => {
    const dock = await DockFactory.merge({ name: 'Quai Détail' }).create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()

    const found = await showDischarge(discharge.id)

    assert.equal(found.id, discharge.id)
    assert.equal(found.dock.name, 'Quai Détail')
  })
})

async function seedDischarge() {
  const dock = await DockFactory.create()

  return DischargeFactory.merge({ dockId: dock.id }).create()
}

async function seedDoor(warehouseState?: 'archived', doorState?: 'archived') {
  const warehouseFactory = warehouseState
    ? WarehouseFactory.apply(warehouseState)
    : WarehouseFactory
  const warehouse = await warehouseFactory.create()
  const doorFactory = doorState ? WarehouseDoorFactory.apply(doorState) : WarehouseDoorFactory

  return doorFactory.merge({ warehouseId: warehouse.id }).create()
}

test.group('Discharge detail product lots', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('orders lots by customer, then product, then identity', async ({ assert }) => {
    const discharge = await seedDischarge()
    const bravo = await CustomerFactory.merge({ companyName: 'Bravo Grains' }).create()
    const alpha = await CustomerFactory.merge({ companyName: 'Alpha Négoce' }).create()
    await ProductLotFactory.merge([
      { customerId: bravo.id, dischargeId: discharge.id, productName: 'Blé tendre' },
      { customerId: alpha.id, dischargeId: discharge.id, productName: 'Orge' },
      { customerId: alpha.id, dischargeId: discharge.id, productName: 'Colza' },
    ]).createMany(3)

    const found = await showDischarge(discharge.id)

    assert.deepEqual(
      found.productLots.map((lot) => `${lot.customer.companyName} / ${lot.productName}`),
      ['Alpha Négoce / Colza', 'Alpha Négoce / Orge', 'Bravo Grains / Blé tendre'],
    )
  })

  test('keeps every door assignment of a lot, in effect or ended, one entry per period', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const customer = await CustomerFactory.create()
    const lot = await ProductLotFactory.merge({
      customerId: customer.id,
      dischargeId: discharge.id,
    }).create()
    const doorA = await seedDoor()
    const doorB = await seedDoor()
    const t0 = DateTime.utc(2026, 9, 1, 6)
    await WarehouseDoorProductLotAssignmentFactory.merge([
      {
        dischargeId: discharge.id,
        effectiveFrom: t0.plus({ days: 2 }),
        effectiveTo: null,
        productLotId: lot.id,
        warehouseDoorId: doorA.id,
      },
      {
        dischargeId: discharge.id,
        effectiveFrom: t0,
        effectiveTo: t0.plus({ days: 1 }),
        productLotId: lot.id,
        warehouseDoorId: doorB.id,
      },
      {
        dischargeId: discharge.id,
        effectiveFrom: t0.plus({ days: 1 }),
        effectiveTo: t0.plus({ days: 2 }),
        productLotId: lot.id,
        warehouseDoorId: doorA.id,
      },
    ]).createMany(3)

    const found = await showDischarge(discharge.id)
    const assignments = found.productLots[0].doorAssignments

    assert.deepEqual(
      assignments.map((assignment) => assignment.warehouseDoor.name),
      [doorB.name, doorA.name, doorA.name],
    )
    assert.deepEqual(
      assignments.map((assignment) => assignment.effectiveTo === null),
      [false, false, true],
    )
    assert.equal(assignments[0].warehouseDoor.warehouse.id, doorB.warehouseId)
  })

  test('reads archived customers, warehouses, and doors rather than filtering them out', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const customer = await CustomerFactory.apply('archived').create()
    const lot = await ProductLotFactory.merge({
      customerId: customer.id,
      dischargeId: discharge.id,
    }).create()
    const door = await seedDoor('archived', 'archived')
    await WarehouseDoorProductLotAssignmentFactory.merge({
      dischargeId: discharge.id,
      productLotId: lot.id,
      warehouseDoorId: door.id,
    }).create()

    const found = await showDischarge(discharge.id)
    const [foundLot] = found.productLots

    assert.equal(foundLot.customer.status, 'ARCHIVED')
    assert.equal(foundLot.doorAssignments[0].warehouseDoor.status, 'ARCHIVED')
    assert.equal(foundLot.doorAssignments[0].warehouseDoor.warehouse.status, 'ARCHIVED')
  })
})

test.group('Discharge detail serialization', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function serialize(dischargeId: string) {
    return new DischargeDetailTransformer(await showDischarge(dischargeId)).toObject()
  }

  test('serializes quantities with three decimals and sums the expected tonnage exactly', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const customer = await CustomerFactory.create()
    await ProductLotFactory.merge([
      {
        customerId: customer.id,
        dischargeId: discharge.id,
        expectedQuantityTonnes: new Decimal('0.1'),
        productName: 'Lot A',
      },
      {
        customerId: customer.id,
        dischargeId: discharge.id,
        expectedQuantityTonnes: new Decimal('0.2'),
        productName: 'Lot B',
      },
      {
        customerId: customer.id,
        dischargeId: discharge.id,
        expectedQuantityTonnes: new Decimal('12.5'),
        productName: 'Lot C',
      },
    ]).createMany(3)

    const detail = await serialize(discharge.id)

    assert.deepEqual(
      detail.productLots.map((lot) => lot.expectedQuantityTonnes),
      ['0.100', '0.200', '12.500'],
    )
    assert.equal(detail.expectedTonnage, '12.800')
  })

  test('reports a zero expected tonnage for a discharge with no lot', async ({ assert }) => {
    const discharge = await seedDischarge()

    const detail = await serialize(discharge.id)

    assert.equal(detail.expectedTonnage, '0.000')
    assert.deepEqual(detail.productLots, [])
  })

  test('serializes every reference as its label and current status', async ({ assert }) => {
    const discharge = await seedDischarge()
    const customer = await CustomerFactory.merge({ companyName: 'Silo Référence' }).create()
    const lot = await ProductLotFactory.merge({
      customerId: customer.id,
      description: null,
      dischargeId: discharge.id,
    }).create()
    const door = await seedDoor(undefined, 'archived')
    await WarehouseDoorProductLotAssignmentFactory.merge({
      dischargeId: discharge.id,
      productLotId: lot.id,
      warehouseDoorId: door.id,
    }).create()

    const detail = await serialize(discharge.id)
    const [serializedLot] = detail.productLots
    const [assignment] = serializedLot.doorAssignments

    assert.deepEqual(serializedLot.customer, {
      id: customer.id,
      name: 'Silo Référence',
      status: 'AVAILABLE',
    })
    assert.isNull(serializedLot.description)
    assert.deepEqual(assignment.warehouseDoor, { id: door.id, name: door.name, status: 'ARCHIVED' })
    assert.equal(assignment.warehouse.id, door.warehouseId)
    assert.equal(assignment.warehouse.status, 'AVAILABLE')
    assert.isNull(assignment.effectiveTo)
  })
})

test.group('Discharge detail shifts', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('orders shifts by planned start, each with its responsible and every membership', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const responsible = await UserFactory.apply('active')
      .merge({ firstName: 'Léa', lastName: 'Martin' })
      .create()
    const start = DateTime.utc(2026, 10, 4, 6)
    const [later, earlier] = await ShiftFactory.merge([
      {
        dischargeId: discharge.id,
        plannedEndAt: start.plus({ hours: 20 }),
        plannedStartAt: start.plus({ hours: 12 }),
        responsibleUserId: responsible.id,
        sequence: 2,
      },
      {
        dischargeId: discharge.id,
        plannedEndAt: start.plus({ hours: 8 }),
        plannedStartAt: start,
        responsibleUserId: responsible.id,
        sequence: 1,
      },
    ]).createMany(2)
    const door = await seedDoor()
    const weighingArea = await WeighingAreaFactory.apply('archived').create()
    const t0 = DateTime.utc(2026, 10, 4, 6)
    await ShiftWarehouseDoorFactory.merge([
      { effectiveFrom: t0.plus({ hours: 2 }), shiftId: earlier.id, warehouseDoorId: door.id },
      {
        effectiveFrom: t0,
        effectiveTo: t0.plus({ hours: 2 }),
        shiftId: earlier.id,
        warehouseDoorId: door.id,
      },
    ]).createMany(2)
    await ShiftWeighingAreaFactory.merge({
      shiftId: earlier.id,
      weighingAreaId: weighingArea.id,
    }).create()

    const found = await showDischarge(discharge.id)

    assert.deepEqual(
      found.shifts.map((shift) => shift.id),
      [earlier.id, later.id],
    )
    const [first] = found.shifts
    assert.equal(first.responsible.lastName, 'Martin')
    assert.deepEqual(
      first.warehouseDoorMemberships.map((membership) => membership.effectiveTo === null),
      [false, true],
    )
    assert.equal(first.warehouseDoorMemberships[0].warehouseDoor.warehouse.id, door.warehouseId)
    assert.equal(first.weighingAreaMemberships[0].weighingArea.status, 'ARCHIVED')
    assert.deepEqual(found.shifts[1].truckMemberships, [])
  })

  test('names a shift truck by the registration its pool captured, not its current one', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const responsible = await UserFactory.apply('active').create()
    const shift = await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
    }).create()
    const pooled = await TruckFactory.apply('suspended').merge({ registration: 'NEW-001' }).create()
    const unpooled = await TruckFactory.merge({ registration: 'CURRENT-002' }).create()
    await DischargeTruckAssignmentFactory.merge({
      dischargeId: discharge.id,
      registrationSnapshot: 'CAPTURED-001',
      truckId: pooled.id,
    }).create()
    await ShiftTruckFactory.merge([
      { shiftId: shift.id, truckId: pooled.id },
      { shiftId: shift.id, truckId: unpooled.id },
    ]).createMany(2)

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()
    const trucks = detail.shifts[0].trucks

    const byTruck = new Map(trucks.map((truck) => [truck.truckId, truck]))
    assert.equal(byTruck.get(pooled.id)?.registration, 'CAPTURED-001')
    assert.equal(byTruck.get(pooled.id)?.truckStatus, 'SUSPENDED')
    // No pool entry to read a capture from: the current registration beats a blank one.
    assert.equal(byTruck.get(unpooled.id)?.registration, 'CURRENT-002')
  })

  test('serializes a shift with its responsible named and nothing else about them', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const responsible = await UserFactory.apply('active')
      .merge({ email: 'lea.martin@portflow.test', firstName: 'Léa', lastName: 'Martin' })
      .create()
    const shift = await ShiftFactory.apply('active')
      .merge({ dischargeId: discharge.id, responsibleUserId: responsible.id })
      .create()
    const weighingArea = await WeighingAreaFactory.create()
    await ShiftWeighingAreaFactory.merge({
      shiftId: shift.id,
      weighingAreaId: weighingArea.id,
    }).create()

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()
    const [serialized] = detail.shifts

    assert.equal(serialized.status, 'ACTIVE')
    assert.deepEqual(serialized.responsible, {
      id: responsible.id,
      firstName: 'Léa',
      lastName: 'Martin',
    })
    assert.deepEqual(serialized.warehouseDoors, [])
    assert.deepEqual(serialized.weighingAreas[0].weighingArea, {
      id: weighingArea.id,
      name: weighingArea.name,
      status: 'AVAILABLE',
    })
    assert.isNull(serialized.weighingAreas[0].effectiveTo)
  })
})

test.group('Discharge detail truck pool', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('keeps every truck ever reserved, held or released, by captured registration', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const [first, second, third] = await TruckFactory.createMany(3)
    await DischargeTruckAssignmentFactory.merge([
      { dischargeId: discharge.id, registrationSnapshot: 'CC-300-CC', truckId: first.id },
      { dischargeId: discharge.id, registrationSnapshot: 'AA-100-AA', truckId: second.id },
    ]).createMany(2)
    await DischargeTruckAssignmentFactory.apply('released')
      .merge({ dischargeId: discharge.id, registrationSnapshot: 'BB-200-BB', truckId: third.id })
      .create()

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()

    assert.deepEqual(
      detail.truckPool.map((entry) => entry.registration),
      ['AA-100-AA', 'BB-200-BB', 'CC-300-CC'],
    )
    assert.isNull(detail.truckPool[0].releasedAt)
    assert.isNotNull(detail.truckPool[1].releasedAt)
  })

  test('shows what the reservation captured even after the truck and its company changed', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const formerCompany = await TransportCompanyFactory.apply('archived').create()
    const truck = await TruckFactory.apply('archived').merge({ registration: 'NEW-PLATE' }).create()
    await DischargeTruckAssignmentFactory.merge({
      dischargeId: discharge.id,
      registrationSnapshot: 'OLD-PLATE',
      transportCompanyId: formerCompany.id,
      transportCompanyNameSnapshot: 'Transports Anciens',
      truckId: truck.id,
    }).create()

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()
    const [entry] = detail.truckPool

    assert.equal(entry.registration, 'OLD-PLATE')
    assert.equal(entry.truckStatus, 'ARCHIVED')
    assert.deepEqual(entry.transportCompany, {
      id: formerCompany.id,
      name: 'Transports Anciens',
      status: 'ARCHIVED',
    })
  })

  test('keeps the captured company name when the company link has been cleared', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const truck = await TruckFactory.apply('suspended').create()
    await DischargeTruckAssignmentFactory.merge({
      dischargeId: discharge.id,
      transportCompanyId: null,
      transportCompanyNameSnapshot: 'Transports Disparus',
      truckId: truck.id,
    }).create()

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()
    const [entry] = detail.truckPool

    assert.equal(entry.truckStatus, 'SUSPENDED')
    assert.deepEqual(entry.transportCompany, {
      id: null,
      name: 'Transports Disparus',
      status: null,
    })
  })
})

test.group('Discharge detail at scale', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('returns the whole graph of a discharge at the planned scale, nothing missing or twice', async ({
    assert,
  }) => {
    const discharge = await seedDischarge()
    const responsible = await UserFactory.apply('active').create()
    const customer = await CustomerFactory.create()
    const door = await seedDoor()
    const weighingArea = await WeighingAreaFactory.create()
    const lots = await ProductLotFactory.merge(
      Array.from({ length: 20 }, (_, index) => ({
        customerId: customer.id,
        dischargeId: discharge.id,
        productName: `Product ${String(index).padStart(2, '0')}`,
      })),
    ).createMany(20)
    const trucks = await TruckFactory.createMany(60)
    await DischargeTruckAssignmentFactory.merge(
      trucks.map((truck, index) => ({
        dischargeId: discharge.id,
        registrationSnapshot: `REG-${String(index).padStart(3, '0')}`,
        truckId: truck.id,
      })),
    ).createMany(60)
    const start = DateTime.utc(2026, 10, 4, 6)
    const shifts = await ShiftFactory.merge(
      Array.from({ length: 40 }, (_, index) => ({
        dischargeId: discharge.id,
        plannedEndAt: start.plus({ hours: index * 12 + 8 }),
        plannedStartAt: start.plus({ hours: index * 12 }),
        responsibleUserId: responsible.id,
        sequence: index + 1,
      })),
    ).createMany(40)
    await ShiftTruckFactory.merge(
      shifts.map((shift, index) => ({ shiftId: shift.id, truckId: trucks[index].id })),
    ).createMany(40)
    await ShiftWarehouseDoorFactory.merge(
      shifts.map((shift) => ({ shiftId: shift.id, warehouseDoorId: door.id })),
    ).createMany(40)
    await ShiftWeighingAreaFactory.merge(
      shifts.map((shift) => ({ shiftId: shift.id, weighingAreaId: weighingArea.id })),
    ).createMany(40)

    const detail = new DischargeDetailTransformer(await showDischarge(discharge.id)).toObject()

    assert.sameMembers(
      detail.productLots.map((lot) => lot.id),
      lots.map((lot) => lot.id),
    )
    assert.lengthOf(detail.truckPool, 60)
    assert.lengthOf(new Set(detail.truckPool.map((entry) => entry.truckId)), 60)
    assert.deepEqual(
      detail.shifts.map((shift) => shift.id),
      shifts.map((shift) => shift.id),
    )
    for (const [index, shift] of detail.shifts.entries()) {
      assert.lengthOf(shift.trucks, 1)
      assert.equal(shift.trucks[0].registration, `REG-${String(index).padStart(3, '0')}`)
      assert.lengthOf(shift.warehouseDoors, 1)
      assert.lengthOf(shift.weighingAreas, 1)
    }
  })
})
