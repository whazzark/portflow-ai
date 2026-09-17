import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { ShiftWeighingAreaFactory } from '#database/factories/shift_resource_membership_factories'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import type { DischargeStatus } from '#models/discharge'
import Discharge from '#models/discharge'

import {
  assignDoorToLot,
  createPreparedDischarge,
  preparer,
  reserveTruck,
} from '../preparation/preparation_scenario.ts'
import { createStartableDischarge, planRows, startRows } from './start_scenario.ts'

type Problem = { code: string; subject: { id: string }; holder?: { vesselName: string } }

/**
 * A second discharge on the same dock, holding the same truck, with a current assignment of the
 * same door: everything a start of the first one would claim.
 */
async function competitor(
  startable: Awaited<ReturnType<typeof createStartableDischarge>>,
  status: DischargeStatus,
  { released = false, ended = false } = {},
) {
  const other = await createPreparedDischarge()
  await Discharge.query()
    .where('id', other.discharge.id)
    .update({ dockId: startable.dock.id, vesselName: 'MV Ocean Cedar' })
  await reserveTruck(other.discharge, startable.truck, { released })
  const assignment = await assignDoorToLot(other, other.wheat.id, startable.references.doorA1.id)
  if (ended) {
    assignment.effectiveTo = DateTime.utc(2026, 8, 2, 6)
    await assignment.save()
  }
  // Last, so a second active discharge on one dock never exists before its competitor is set up.
  await Discharge.query().where('id', other.discharge.id).update({ status })

  return other
}

const conflicts = (problems: Problem[]) =>
  problems
    .filter((problem) => problem.code.endsWith('_HELD'))
    .map((problem) => ({
      code: problem.code,
      id: problem.subject.id,
      vessel: problem.holder?.vesselName,
    }))

test.group('Discharge start conflicts with other discharges', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses a dock, truck, and door held by an active discharge, changing neither', async ({
    assert,
    client,
  }) => {
    const startable = await createStartableDischarge()
    // Created planned, then moved to the dock: two active discharges never share it, even here.
    const other = await createPreparedDischarge()
    await reserveTruck(other.discharge, startable.truck)
    await assignDoorToLot(other, other.wheat.id, startable.references.doorA1.id)
    await Discharge.query()
      .where('id', other.discharge.id)
      .update({ status: 'ACTIVE', vesselName: 'MV Ocean Cedar' })
    await Discharge.query().where('id', startable.discharge.id).update({ dockId: other.dock.id })
    const user = await preparer()
    const expected = [
      { code: 'DOCK_HELD', id: other.dock.id, vessel: 'MV Ocean Cedar' },
      { code: 'TRUCK_HELD', id: startable.truck.id, vessel: 'MV Ocean Cedar' },
      { code: 'WAREHOUSE_DOOR_HELD', id: startable.references.doorA1.id, vessel: 'MV Ocean Cedar' },
    ]
    const before = {
      started: await startRows(startable.discharge.id),
      plan: await planRows(startable.discharge.id),
      other: await startRows(other.discharge.id),
      otherPlan: await planRows(other.discharge.id),
    }

    const check = await client
      .get(`/api/v1/discharges/${startable.discharge.id}/start-check`)
      .loginAs(user)
    const start = await client
      .post(`/api/v1/discharges/${startable.discharge.id}/start`)
      .loginAs(user)

    check.assertStatus(200)
    assert.deepEqual(conflicts(check.body().data.problems), expected)
    start.assertStatus(409)
    assert.equal(start.body().error.code, 'E_DISCHARGE_START_REFUSED')
    assert.equal(start.body().error.meta.shiftId, startable.shift.id)
    assert.deepEqual(conflicts(start.body().error.meta.problems), expected)
    assert.deepEqual(
      {
        started: await startRows(startable.discharge.id),
        plan: await planRows(startable.discharge.id),
        other: await startRows(other.discharge.id),
        otherPlan: await planRows(other.discharge.id),
      },
      before,
    )
  })

  test('lets planned and closed discharges share everything', async ({ assert, client }) => {
    for (const status of ['PLANNED', 'CLOSED'] as const) {
      const startable = await createStartableDischarge()
      const other = await competitor(startable, status)
      const before = await startRows(other.discharge.id)

      const response = await client
        .post(`/api/v1/discharges/${startable.discharge.id}/start`)
        .loginAs(await preparer())

      response.assertStatus(200)
      assert.equal(response.body().data.status, 'ACTIVE')
      assert.deepEqual(await startRows(other.discharge.id), before)
    }
  })

  test('ignores a released truck and an ended door assignment of an active discharge', async ({
    client,
  }) => {
    const startable = await createStartableDischarge()
    const other = await competitor(startable, 'PLANNED', { released: true, ended: true })
    // Moved off the dock before it becomes active, so only the released and ended rows remain shared.
    const { dock } = await createPreparedDischarge()
    await Discharge.query()
      .where('id', other.discharge.id)
      .update({ dockId: dock.id, status: 'ACTIVE' })

    const response = await client
      .post(`/api/v1/discharges/${startable.discharge.id}/start`)
      .loginAs(await preparer())

    response.assertStatus(200)
  })

  test('shares weighing areas and warehouses with active discharges', async ({ client }) => {
    const startable = await createStartableDischarge()
    const other = await createPreparedDischarge()
    const neighbourDoor = await WarehouseDoorFactory.merge({
      warehouseId: startable.references.magasinA.id,
    }).create()
    await assignDoorToLot(other, other.wheat.id, neighbourDoor.id)
    await ShiftWeighingAreaFactory.merge({
      shiftId: other.shift.id,
      weighingAreaId: startable.references.north.id,
    }).create()
    await Discharge.query().where('id', other.discharge.id).update({ status: 'ACTIVE' })

    const response = await client
      .post(`/api/v1/discharges/${startable.discharge.id}/start`)
      .loginAs(await preparer())

    response.assertStatus(200)
  })
})
