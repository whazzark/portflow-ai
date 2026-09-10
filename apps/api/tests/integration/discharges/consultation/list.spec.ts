import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'
import Discharge from '#models/discharge'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import { USER_ROLES } from '#models/user'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

/**
 * These specs assert on the whole collection, so the table has to be genuinely empty first — and
 * earlier suites commit discharges of their own. A global transaction would only roll back this
 * group's writes, so the preparation graph is deleted outermost-first instead, children before the
 * discharges they hang off.
 */
async function deleteEveryDischarge() {
  await ShiftTruck.query().delete()
  await ShiftWarehouseDoor.query().delete()
  await ShiftWeighingArea.query().delete()
  await Shift.query().delete()
  await WarehouseDoorProductLotAssignment.query().delete()
  await DischargeTruckAssignment.query().delete()
  await ProductLot.query().delete()
  await Discharge.query().delete()
}

test.group('Discharge consultation HTTP contract', (group) => {
  group.each.setup(() => deleteEveryDischarge())

  test('denies unauthenticated and non-active access without disclosing any discharge', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    await DischargeFactory.merge({ dockId: dock.id, vesselName: 'MV Confidential' }).create()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_ADMIN' }).create()

    const unauthenticated = await client.get('/api/v1/discharges')
    const nonActive = await client.get('/api/v1/discharges').loginAs(pending)

    // Both are 401: the auth middleware refuses a session whose user is not ACTIVE before any
    // policy runs, so a non-active user never reaches the authorization layer.
    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
    assert.notInclude(JSON.stringify(unauthenticated.body()), 'MV Confidential')
    assert.notInclude(JSON.stringify(nonActive.body()), 'MV Confidential')
  })

  test('serves every active role the same collection across all three statuses', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const active = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const closed = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    const expected = [planned.id, active.id, closed.id].sort()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get('/api/v1/discharges').loginAs(user)

      response.assertStatus(200)
      assert.deepEqual(
        response
          .body()
          .data.map((discharge: { id: string }) => discharge.id)
          .sort(),
        expected,
        `expected ${role} to read every status`,
      )
    }
  })

  test('exposes the browsing fields and withholds the detail ones', async ({ assert, client }) => {
    const dock = await DockFactory.merge({ name: 'Quai Sud' }).create()
    const customer = await CustomerFactory.merge({ companyName: 'Silo Atlantique' }).create()
    const responsible = await UserFactory.apply('active').create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const discharge = await DischargeFactory.merge({
      dockId: dock.id,
      expectedStartAt: DateTime.utc(2026, 10, 4, 6),
      vesselImo: '9876543',
      vesselName: 'MV Contract Check',
    }).create()
    await ProductLotFactory.merge({
      customerId: customer.id,
      dischargeId: discharge.id,
      productName: 'Tourteau de soja',
    }).create()
    await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
    }).create()

    const response = await client.get('/api/v1/discharges').loginAs(user)
    const [body] = response.body().data

    response.assertStatus(200)
    assert.properties(body, [
      'id',
      'status',
      'vesselName',
      'vesselImo',
      'expectedStartAt',
      'dock',
      'productLots',
      'shiftCount',
    ])
    assert.equal(body.vesselName, 'MV Contract Check')
    assert.equal(body.dock.name, 'Quai Sud')
    assert.equal(body.shiftCount, 1)
    assert.deepEqual(body.productLots, [
      {
        id: body.productLots[0].id,
        customerId: customer.id,
        customerName: 'Silo Atlantique',
        productName: 'Tourteau de soja',
      },
    ])
    for (const withheld of [
      'vesselComment',
      'dockId',
      'createdAt',
      'updatedAt',
      'truckAssignments',
      'doorAssignments',
    ]) {
      assert.notProperty(body, withheld)
    }

    for (const withheld of ['expectedQuantityTonnes', 'description', 'dischargeId']) {
      assert.notProperty(body.productLots[0], withheld)
    }
  })

  test('returns an empty collection rather than an error when the site has no discharge', async ({
    assert,
    client,
  }) => {
    const user = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()

    const response = await client.get('/api/v1/discharges').loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body(), { data: [] })
  })

  test("orders a discharge's product lots identically between two reads", async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const discharge = await DischargeFactory.merge({ dockId: dock.id }).create()
    for (const companyName of ['Lot Order Alpha', 'Lot Order Bravo', 'Lot Order Charlie']) {
      const customer = await CustomerFactory.merge({ companyName }).create()
      await ProductLotFactory.merge({ customerId: customer.id, dischargeId: discharge.id }).create()
    }

    const first = await client.get('/api/v1/discharges').loginAs(user)
    const second = await client.get('/api/v1/discharges').loginAs(user)
    const ids = first.body().data[0].productLots.map((productLot: { id: string }) => productLot.id)

    // The browsing row reads its customers off this order, so an unordered preload would let the
    // same discharge list them one way and then the other.
    assert.lengthOf(ids, 3)
    assert.deepEqual(ids, [...ids].sort())
    assert.deepEqual(
      second.body().data[0].productLots.map((productLot: { id: string }) => productLot.id),
      ids,
    )
  })

  test('serves a null vessel IMO as null rather than omitting it', async ({ assert, client }) => {
    const dock = await DockFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    await DischargeFactory.merge({ dockId: dock.id, vesselImo: null }).create()

    const response = await client.get('/api/v1/discharges').loginAs(user)

    response.assertStatus(200)
    assert.isNull(response.body().data[0].vesselImo)
  })
})
