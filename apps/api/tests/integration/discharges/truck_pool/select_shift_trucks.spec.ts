import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'

import {
  createPreparedDischarge,
  createTruck,
  PREPARING_ROLES,
  preparer,
  reserveTruck,
  selectShiftTruck,
  shiftTruckRows,
} from '../preparation/preparation_scenario.ts'

type ShiftTruck = { id: string; truckId: string; registration: string; effectiveTo: string | null }

const url = (dischargeId: string, shiftId: string) =>
  `/api/v1/discharges/${dischargeId}/shifts/${shiftId}/trucks`

async function currentTruckIds(shiftId: string) {
  return (await shiftTruckRows(shiftId))
    .filter((row) => row.effectiveTo === null)
    .map((row) => row.truckId)
    .sort()
}

test.group('Shift truck selection HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, shift } = await createPreparedDischarge()
    const { truck } = await createTruck()
    await reserveTruck(discharge, truck)
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = { truckIds: [truck.id] }

    ;(await client.put(url(discharge.id, shift.id)).json(body)).assertStatus(401)
    ;(await client.put(url(discharge.id, shift.id)).json(body).loginAs(pending)).assertStatus(401)
    ;(await client.put(url(discharge.id, shift.id)).json(body).loginAs(observer)).assertStatus(403)

    assert.deepEqual(await shiftTruckRows(shift.id), [])
  })

  test('replaces a shift selection for every preparing role, keeping what stays selected', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, shift } = await createPreparedDischarge()
      const { truck: first } = await createTruck()
      const { truck: second } = await createTruck()
      await reserveTruck(discharge, first)
      await reserveTruck(discharge, second)
      const lead = await preparer(role)

      ;(
        await client
          .put(url(discharge.id, shift.id))
          .json({ truckIds: [first.id] })
          .loginAs(lead)
      ).assertStatus(200)
      const [kept] = await shiftTruckRows(shift.id)

      const grown = await client
        .put(url(discharge.id, shift.id))
        .json({ truckIds: [first.id, second.id] })
        .loginAs(lead)
      grown.assertStatus(200)
      assert.include(
        (await shiftTruckRows(shift.id)).map((row) => row.id),
        kept.id,
      )
      const trucks = grown.body().data.shifts[0].trucks as ShiftTruck[]
      assert.equal(
        trucks.find((row) => row.truckId === second.id)?.registration,
        second.registration,
      )

      ;(
        await client
          .put(url(discharge.id, shift.id))
          .json({ truckIds: [second.id] })
          .loginAs(lead)
      ).assertStatus(200)
      assert.deepEqual(await currentTruckIds(shift.id), [second.id])

      ;(
        await client.put(url(discharge.id, shift.id)).json({ truckIds: [] }).loginAs(lead)
      ).assertStatus(200)
      assert.deepEqual(await shiftTruckRows(shift.id), [])
    }
  })

  test('leaves other shifts and ended periods alone, and replays harmlessly', async ({
    assert,
    client,
  }) => {
    const { discharge, shift, responsible } = await createPreparedDischarge()
    const other = await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
      sequence: 2,
    }).create()
    const { truck } = await createTruck()
    await reserveTruck(discharge, truck)
    await selectShiftTruck(other, truck)
    const ended = await selectShiftTruck(shift, truck, { ended: true })
    const lead = await preparer()

    await client
      .put(url(discharge.id, shift.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)
    const afterFirst = await shiftTruckRows(shift.id)
    await client
      .put(url(discharge.id, shift.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)

    assert.deepEqual(await shiftTruckRows(shift.id), afterFirst)
    assert.include(
      afterFirst.map((row) => row.id),
      ended.id,
    )
    assert.deepEqual(await currentTruckIds(other.id), [truck.id])

    await client.put(url(discharge.id, shift.id)).json({ truckIds: [] }).loginAs(lead)
    assert.deepEqual(
      (await shiftTruckRows(shift.id)).map((row) => row.id),
      [ended.id],
    )
  })

  test('answers an unknown discharge or shift, and a started one, with their refusals', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const planned = await createPreparedDischarge()
    const otherDischarge = await createPreparedDischarge()
    const active = await createPreparedDischarge('ACTIVE')
    const closed = await createPreparedDischarge('CLOSED')
    const startedShift = await ShiftFactory.apply('active')
      .merge({
        dischargeId: planned.discharge.id,
        responsibleUserId: planned.responsible.id,
        sequence: 2,
      })
      .create()
    const body = { truckIds: [] }

    for (const shiftId of [
      '00000000-0000-4000-8000-000000000000',
      'not-a-uuid',
      otherDischarge.shift.id,
    ]) {
      const response = await client.put(url(planned.discharge.id, shiftId)).json(body).loginAs(lead)
      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_SHIFT_NOT_FOUND')
    }

    const unknown = await client
      .put(url('00000000-0000-4000-8000-000000000000', planned.shift.id))
      .json(body)
      .loginAs(lead)
    unknown.assertStatus(404)
    assert.equal(unknown.body().error.code, 'E_DISCHARGE_NOT_FOUND')

    for (const { discharge, shift } of [active, closed]) {
      const response = await client.put(url(discharge.id, shift.id)).json(body).loginAs(lead)
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
    }

    const notPlanned = await client
      .put(url(planned.discharge.id, startedShift.id))
      .json(body)
      .loginAs(lead)
    notPlanned.assertStatus(409)
    assert.equal(notPlanned.body().error.code, 'E_SHIFT_NOT_PLANNED')
  })

  test('refuses trucks the discharge does not hold, and a newly selected suspended one', async ({
    assert,
    client,
  }) => {
    const { discharge, shift } = await createPreparedDischarge()
    const elsewhere = await createPreparedDischarge()
    const { truck: foreign } = await createTruck()
    const { truck: released } = await createTruck()
    const { truck: suspended } = await createTruck('SUSPENDED')
    const { truck: keptSuspended } = await createTruck('SUSPENDED')
    await reserveTruck(elsewhere.discharge, foreign)
    await reserveTruck(discharge, released, { released: true })
    await reserveTruck(discharge, suspended)
    await reserveTruck(discharge, keptSuspended)
    await selectShiftTruck(shift, keptSuspended)
    const lead = await preparer()
    const before = await shiftTruckRows(shift.id)

    const unheld = await client
      .put(url(discharge.id, shift.id))
      .json({ truckIds: [keptSuspended.id, foreign.id, released.id] })
      .loginAs(lead)
    unheld.assertStatus(422)
    assert.deepEqual(
      unheld
        .body()
        .error.details.map((issue: { field: string; rule: string }) => [issue.field, issue.rule]),
      [
        ['truckIds.1', 'heldTruck'],
        ['truckIds.2', 'heldTruck'],
      ],
    )

    const newlySuspended = await client
      .put(url(discharge.id, shift.id))
      .json({ truckIds: [keptSuspended.id, suspended.id] })
      .loginAs(lead)
    newlySuspended.assertStatus(422)
    assert.equal(newlySuspended.body().error.details[0].rule, 'selectableTruck')
    assert.deepEqual(await shiftTruckRows(shift.id), before)

    const kept = await client
      .put(url(discharge.id, shift.id))
      .json({ truckIds: [keptSuspended.id] })
      .loginAs(lead)
    kept.assertStatus(200)
    assert.deepEqual(await shiftTruckRows(shift.id), before)
  })
})
