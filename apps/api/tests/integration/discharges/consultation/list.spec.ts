import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { Decimal } from 'decimal.js'
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

import { preparer } from '../preparation/preparation_scenario.ts'
import { createStartableDischarge } from '../start/start_scenario.ts'

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

type ListedShift = {
  id: string
  sequence: number
  plannedStartAt: string
  plannedEndAt: string
  responsible: { id: string; firstName: string; lastName: string }
}

type ListedDischarge = {
  id: string
  startedAt: string | null
  expectedTonnage: string
  activeShift: ListedShift | null
  nextShift: ListedShift | null
  startProblemCount: number | null
}

/** Looks a discharge up in a listing by identity, failing loudly when it is not listed. */
function listedById(data: ListedDischarge[]) {
  const byId = new Map(data.map((discharge) => [discharge.id, discharge]))

  return (id: string) => {
    const found = byId.get(id)

    if (!found) {
      throw new Error(`Discharge ${id} is not listed`)
    }

    return found
  }
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

  test('carries the actual start and the expected tonnage every status shows', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const customer = await CustomerFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const active = await DischargeFactory.apply('active')
      .merge({ dockId: dock.id, startedAt: DateTime.utc(2026, 9, 12, 4) })
      .create()
    for (const expectedQuantityTonnes of ['1000.250', '2000.500']) {
      await ProductLotFactory.merge({
        customerId: customer.id,
        dischargeId: active.id,
        expectedQuantityTonnes: new Decimal(expectedQuantityTonnes),
      }).create()
    }

    const response = await client.get('/api/v1/discharges').loginAs(user)
    const listed = listedById(response.body().data)

    response.assertStatus(200)
    assert.equal(
      new Date(listed(active.id).startedAt ?? '').toISOString(),
      '2026-09-12T04:00:00.000Z',
    )
    assert.equal(listed(active.id).expectedTonnage, '3000.750')
    // A planned discharge has not started, and one without a lot expects nothing yet.
    assert.isNull(listed(planned.id).startedAt)
    assert.equal(listed(planned.id).expectedTonnage, '0.000')
  })

  test("names an active discharge's shift in progress and the one that comes next", async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const running = await UserFactory.apply('active')
      .merge({ firstName: 'Sophie', lastName: 'Dubois' })
      .create()
    const following = await UserFactory.apply('active')
      .merge({ firstName: 'Thomas', lastName: 'Bernard' })
      .create()
    const discharge = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const start = DateTime.utc(2026, 9, 12, 4)
    await ShiftFactory.apply('completed')
      .merge({
        dischargeId: discharge.id,
        plannedEndAt: start.plus({ hours: 12 }),
        plannedStartAt: start,
        responsibleUserId: following.id,
        sequence: 1,
      })
      .create()
    const active = await ShiftFactory.apply('active')
      .merge({
        dischargeId: discharge.id,
        plannedEndAt: start.plus({ hours: 24 }),
        plannedStartAt: start.plus({ hours: 12 }),
        responsibleUserId: running.id,
        sequence: 2,
      })
      .create()
    const next = await ShiftFactory.merge({
      dischargeId: discharge.id,
      plannedEndAt: start.plus({ hours: 36 }),
      plannedStartAt: start.plus({ hours: 24 }),
      responsibleUserId: following.id,
      sequence: 3,
    }).create()

    const response = await client.get('/api/v1/discharges').loginAs(user)
    const [body] = response.body().data

    response.assertStatus(200)
    assert.equal(body.shiftCount, 3)
    assert.deepEqual(body.activeShift, {
      id: active.id,
      sequence: 2,
      plannedStartAt: body.activeShift?.plannedStartAt,
      plannedEndAt: body.activeShift?.plannedEndAt,
      responsible: { id: running.id, firstName: 'Sophie', lastName: 'Dubois' },
    })
    assert.equal(
      new Date(body.activeShift?.plannedStartAt).toISOString(),
      '2026-09-12T16:00:00.000Z',
    )
    assert.equal(new Date(body.activeShift?.plannedEndAt).toISOString(), '2026-09-13T04:00:00.000Z')
    assert.equal(body.nextShift?.id, next.id)
    assert.equal(body.nextShift?.sequence, 3)
    assert.deepEqual(body.nextShift?.responsible, {
      id: following.id,
      firstName: 'Thomas',
      lastName: 'Bernard',
    })
  })

  test('has no shift in progress between two shifts, and none at all once all are done', async ({
    assert,
    client,
  }) => {
    // Two active discharges cannot hold the same dock.
    const [betweenDock, finishedDock] = await DockFactory.createMany(2)
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const responsible = await UserFactory.apply('active').create()
    const between = await DischargeFactory.apply('active')
      .merge({ dockId: betweenDock.id })
      .create()
    const finished = await DischargeFactory.apply('active')
      .merge({ dockId: finishedDock.id })
      .create()
    await ShiftFactory.apply('completed')
      .merge([
        { dischargeId: between.id, responsibleUserId: responsible.id, sequence: 1 },
        { dischargeId: finished.id, responsibleUserId: responsible.id, sequence: 1 },
      ])
      .createMany(2)
    const next = await ShiftFactory.merge({
      dischargeId: between.id,
      responsibleUserId: responsible.id,
      sequence: 2,
    }).create()

    const response = await client.get('/api/v1/discharges').loginAs(user)
    const listed = listedById(response.body().data)

    response.assertStatus(200)
    assert.isNull(listed(between.id).activeShift)
    assert.equal(listed(between.id).nextShift?.id, next.id)
    assert.isNull(listed(finished.id).activeShift)
    assert.isNull(listed(finished.id).nextShift)
  })

  test('gives planned and closed discharges no shift summary', async ({ assert, client }) => {
    const dock = await DockFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const responsible = await UserFactory.apply('active').create()
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const closed = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    await ShiftFactory.merge({
      dischargeId: planned.id,
      responsibleUserId: responsible.id,
      sequence: 1,
    }).create()
    await ShiftFactory.apply('completed')
      .merge({ dischargeId: closed.id, responsibleUserId: responsible.id, sequence: 1 })
      .create()

    const response = await client.get('/api/v1/discharges').loginAs(user)

    response.assertStatus(200)
    for (const body of response.body().data) {
      assert.isNull(body.activeShift)
      assert.isNull(body.nextShift)
    }
  })

  test('still names the responsible of a shift in progress after they lose access', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const responsible = await UserFactory.apply('deactivated')
      .merge({ firstName: 'Claire', lastName: 'Martin' })
      .create()
    const discharge = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    await ShiftFactory.apply('active')
      .merge({ dischargeId: discharge.id, responsibleUserId: responsible.id, sequence: 1 })
      .create()

    const response = await client.get('/api/v1/discharges').loginAs(user)
    const [body] = response.body().data

    response.assertStatus(200)
    assert.deepEqual(body.activeShift?.responsible, {
      id: responsible.id,
      firstName: 'Claire',
      lastName: 'Martin',
    })
  })

  test('counts the start problems of each planned discharge as its start check reports them', async ({
    assert,
    cleanup,
    client,
  }) => {
    // A startable plan commits trucks, doors, and checkpoints that later suites must not inherit,
    // so this test, unlike the others, rolls back everything it wrote.
    cleanup(await testUtils.db().wrapInGlobalTransaction())
    const { discharge: startable } = await createStartableDischarge()
    const dock = await DockFactory.create()
    // Planned with nothing yet: no product lot and no shift are each a problem.
    const bare = await DischargeFactory.merge({ dockId: dock.id }).create()
    const active = await DischargeFactory.apply('active').merge({ dockId: dock.id }).create()
    const closed = await DischargeFactory.apply('closed').merge({ dockId: dock.id }).create()
    const lead = await preparer()

    const response = await client.get('/api/v1/discharges').loginAs(lead)
    const listed = listedById(response.body().data)

    response.assertStatus(200)
    assert.equal(listed(startable.id).startProblemCount, 0)
    assert.isAtLeast(listed(bare.id).startProblemCount ?? 0, 2)
    assert.isNull(listed(active.id).startProblemCount)
    assert.isNull(listed(closed.id).startProblemCount)

    // The badge and the start dialog read the same evaluation, so they never disagree.
    for (const planned of [startable, bare]) {
      const check = await client.get(`/api/v1/discharges/${planned.id}/start-check`).loginAs(lead)

      check.assertStatus(200)
      assert.equal(listed(planned.id).startProblemCount, check.body().data.problems.length)
    }
  })

  test('serves every role the start problem count, observers included', async ({
    assert,
    client,
  }) => {
    const dock = await DockFactory.create()
    const planned = await DischargeFactory.merge({ dockId: dock.id }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get('/api/v1/discharges').loginAs(observer)

    response.assertStatus(200)
    assert.equal(response.body().data[0].id, planned.id)
    assert.isAtLeast(response.body().data[0].startProblemCount, 2)
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
