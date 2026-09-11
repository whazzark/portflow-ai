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
import { USER_ROLES } from '#models/user'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

test.group('Discharge detail HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('denies unauthenticated and non-active access without disclosing the discharge', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.merge({
      dockId: dock.id,
      vesselName: 'MV Confidential Detail',
    }).create()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_ADMIN' }).create()

    const unauthenticated = await client.get(`/api/v1/discharges/${discharge.id}`)
    const nonActive = await client.get(`/api/v1/discharges/${discharge.id}`).loginAs(pending)

    // Both are 401, as on the list: the auth middleware refuses a non-active session before the
    // policy runs.
    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
    assert.notInclude(JSON.stringify(unauthenticated.body()), 'MV Confidential Detail')
    assert.notInclude(JSON.stringify(nonActive.body()), 'MV Confidential Detail')
  })

  test('serves every active role the same detail, whatever the discharge status', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.merge({ name: 'Quai Identité' }).create()
    const discharges = [
      await DischargeFactory.merge({
        dockId: dock.id,
        expectedStartAt: DateTime.utc(2026, 10, 4, 6),
        vesselComment: 'Draught restricted at low tide',
        vesselImo: '9876543',
        vesselName: 'MV Planned Detail',
      }).create(),
      await DischargeFactory.apply('active').merge({ dockId: dock.id }).create(),
      await DischargeFactory.apply('closed').merge({ dockId: dock.id, vesselImo: null }).create(),
    ]

    for (const discharge of discharges) {
      const bodies = []

      for (const role of USER_ROLES) {
        const user = await UserFactory.apply('active').merge({ role }).create()
        const response = await client.get(`/api/v1/discharges/${discharge.id}`).loginAs(user)

        response.assertStatus(200)
        bodies.push(response.body())
      }

      for (const body of bodies.slice(1)) {
        assert.deepEqual(body, bodies[0], 'expected every role to read the same detail')
      }

      const data = bodies[0].data
      assert.equal(data.id, discharge.id)
      assert.equal(data.status, discharge.status)
      assert.equal(data.vesselName, discharge.vesselName)
      assert.equal(data.vesselImo, discharge.vesselImo)
      assert.equal(data.vesselComment, discharge.vesselComment)
      assert.isString(data.expectedStartAt)
      assert.deepEqual(data.dock, { id: dock.id, name: 'Quai Identité', status: 'AVAILABLE' })
    }
  })

  test('gives an observer the labels of archived references and every door period', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.apply('archived').merge({ name: 'Quai Retiré' }).create()
    const customer = await CustomerFactory.apply('archived')
      .merge({ companyName: 'Négoce Retiré' })
      .create()
    const warehouse = await WarehouseFactory.apply('archived')
      .merge({ name: 'Magasin Retiré' })
      .create()
    const door = await WarehouseDoorFactory.apply('archived')
      .merge({ name: 'Porte Retirée', warehouseId: warehouse.id })
      .create()
    const discharge = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    const lot = await ProductLotFactory.merge({
      customerId: customer.id,
      dischargeId: discharge.id,
      expectedQuantityTonnes: new Decimal('1250.5'),
    }).create()
    await WarehouseDoorProductLotAssignmentFactory.merge({
      dischargeId: discharge.id,
      effectiveFrom: DateTime.utc(2026, 8, 1, 6),
      effectiveTo: DateTime.utc(2026, 8, 3, 18),
      productLotId: lot.id,
      warehouseDoorId: door.id,
    }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get(`/api/v1/discharges/${discharge.id}`).loginAs(observer)
    const data = response.body().data

    response.assertStatus(200)
    assert.deepEqual(data.dock, { id: dock.id, name: 'Quai Retiré', status: 'ARCHIVED' })
    assert.equal(data.expectedTonnage, '1250.500')
    assert.deepEqual(data.productLots, [
      {
        id: lot.id,
        productName: lot.productName,
        description: lot.description,
        expectedQuantityTonnes: '1250.500',
        customer: { id: customer.id, name: 'Négoce Retiré', status: 'ARCHIVED' },
        doorAssignments: [
          {
            id: data.productLots[0].doorAssignments[0].id,
            effectiveFrom: data.productLots[0].doorAssignments[0].effectiveFrom,
            effectiveTo: data.productLots[0].doorAssignments[0].effectiveTo,
            warehouseDoor: { id: door.id, name: 'Porte Retirée', status: 'ARCHIVED' },
            warehouse: { id: warehouse.id, name: 'Magasin Retiré', status: 'ARCHIVED' },
          },
        ],
      },
    ])
    assert.isString(data.productLots[0].doorAssignments[0].effectiveFrom)
    assert.isString(data.productLots[0].doorAssignments[0].effectiveTo)
  })

  test('serves the shifts with their resources and no more of the responsible than a name', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const responsible = await UserFactory.apply('active')
      .merge({ email: 'shift.lead@portflow.test', firstName: 'Léa', lastName: 'Martin' })
      .create()
    const shift = await ShiftFactory.apply('active')
      .merge({ dischargeId: discharge.id, responsibleUserId: responsible.id })
      .create()
    const truck = await TruckFactory.create()
    await DischargeTruckAssignmentFactory.merge({
      dischargeId: discharge.id,
      registrationSnapshot: 'AB-123-CD',
      truckId: truck.id,
    }).create()
    const warehouse = await WarehouseFactory.create()
    const door = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()
    const weighingArea = await WeighingAreaFactory.create()
    await ShiftTruckFactory.merge({ shiftId: shift.id, truckId: truck.id }).create()
    await ShiftWarehouseDoorFactory.merge({ shiftId: shift.id, warehouseDoorId: door.id }).create()
    await ShiftWeighingAreaFactory.merge({
      shiftId: shift.id,
      weighingAreaId: weighingArea.id,
    }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get(`/api/v1/discharges/${discharge.id}`).loginAs(observer)
    const [served] = response.body().data.shifts

    response.assertStatus(200)
    assert.properties(served, [
      'id',
      'status',
      'plannedStartAt',
      'plannedEndAt',
      'responsible',
      'trucks',
      'warehouseDoors',
      'weighingAreas',
    ])
    assert.deepEqual(served.responsible, {
      id: responsible.id,
      firstName: 'Léa',
      lastName: 'Martin',
    })
    assert.notInclude(JSON.stringify(response.body()), 'shift.lead@portflow.test')
    assert.equal(served.trucks[0].registration, 'AB-123-CD')
    assert.equal(served.warehouseDoors[0].warehouse.name, warehouse.name)
    assert.equal(served.weighingAreas[0].weighingArea.name, weighingArea.name)
  })

  test('serves a closed discharge its released trucks as they were captured', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const discharge = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    const company = await TransportCompanyFactory.create()
    const truck = await TruckFactory.merge({ transportCompanyId: company.id }).create()
    const assignment = await DischargeTruckAssignmentFactory.apply('released')
      .merge({
        dischargeId: discharge.id,
        registrationSnapshot: 'CL-001-OS',
        transportCompanyId: company.id,
        transportCompanyNameSnapshot: 'Transports du Port',
        truckId: truck.id,
      })
      .create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get(`/api/v1/discharges/${discharge.id}`).loginAs(observer)
    const [entry] = response.body().data.truckPool

    response.assertStatus(200)
    assert.deepEqual(entry, {
      id: assignment.id,
      truckId: truck.id,
      registration: 'CL-001-OS',
      truckStatus: 'AVAILABLE',
      transportCompany: { id: company.id, name: 'Transports du Port', status: 'AVAILABLE' },
      reservedAt: entry.reservedAt,
      releasedAt: entry.releasedAt,
    })
    assert.isString(entry.reservedAt)
    assert.isString(entry.releasedAt)
  })

  test('answers an unknown or malformed identity with the discharge not-found code', async ({
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    for (const id of [UNKNOWN_ID, 'not-a-uuid']) {
      const response = await client.get(`/api/v1/discharges/${id}`).loginAs(user)

      response.assertStatus(404)
      response.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_FOUND' } })
    }
  })
})
