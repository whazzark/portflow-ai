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
  truckPoolRows,
} from '../preparation/preparation_scenario.ts'

type PoolEntry = { truckId: string; otherHoldings: Array<{ dischargeId: string }> }

const url = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/truck-pool/withdrawals`

test.group('Truck withdrawal HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck } = await createTruck()
    await reserveTruck(discharge, truck)
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = { truckIds: [truck.id] }
    const before = await truckPoolRows(discharge.id)

    ;(await client.post(url(discharge.id)).json(body)).assertStatus(401)
    ;(await client.post(url(discharge.id)).json(body).loginAs(pending)).assertStatus(401)
    ;(await client.post(url(discharge.id)).json(body).loginAs(observer)).assertStatus(403)

    assert.deepEqual(await truckPoolRows(discharge.id), before)
  })

  test('withdraws trucks for every preparing role, with their selections in planned shifts', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, shift, responsible } = await createPreparedDischarge()
      const second = await ShiftFactory.merge({
        dischargeId: discharge.id,
        responsibleUserId: responsible.id,
        sequence: 2,
      }).create()
      const { truck: selected } = await createTruck()
      const { truck: idle } = await createTruck()
      const { truck: kept } = await createTruck()
      await reserveTruck(discharge, selected)
      await reserveTruck(discharge, idle)
      await reserveTruck(discharge, kept)
      await selectShiftTruck(shift, selected)
      await selectShiftTruck(second, selected)
      const ended = await selectShiftTruck(shift, selected, { ended: true })
      const keptSelection = await selectShiftTruck(shift, kept)

      const response = await client
        .post(url(discharge.id))
        .json({ truckIds: [selected.id, idle.id] })
        .loginAs(await preparer(role))

      response.assertStatus(200)
      assert.deepEqual(
        (await truckPoolRows(discharge.id)).map((row) => row.truckId),
        [kept.id],
      )
      assert.sameMembers(
        (await shiftTruckRows(shift.id)).map((row) => row.id),
        [ended.id, keptSelection.id],
      )
      assert.deepEqual(await shiftTruckRows(second.id), [])
      assert.notIncludeMembers(
        (response.body().data.truckPool as PoolEntry[]).map((entry) => entry.truckId),
        [selected.id, idle.id],
      )
    }
  })

  test('leaves released rows alone, withdraws a suspended truck, and replays harmlessly', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck: released } = await createTruck()
    const { truck: suspended } = await createTruck('SUSPENDED')
    await reserveTruck(discharge, released, { released: true })
    await reserveTruck(discharge, suspended)
    const lead = await preparer()
    const body = { truckIds: [released.id, suspended.id] }

    ;(await client.post(url(discharge.id)).json(body).loginAs(lead)).assertStatus(200)
    const afterFirst = await truckPoolRows(discharge.id)
    assert.deepEqual(
      afterFirst.map((row) => row.truckId),
      [released.id],
    )

    ;(await client.post(url(discharge.id)).json(body).loginAs(lead)).assertStatus(200)
    assert.deepEqual(await truckPoolRows(discharge.id), afterFirst)
  })

  test('stops being named by another planned discharge holding the same truck', async ({
    assert,
    client,
  }) => {
    const { truck } = await createTruck()
    const withdrawing = await createPreparedDischarge()
    const other = await createPreparedDischarge()
    await reserveTruck(withdrawing.discharge, truck)
    await reserveTruck(other.discharge, truck)
    const lead = await preparer()

    await client
      .post(url(withdrawing.discharge.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)

    const detail = await client.get(`/api/v1/discharges/${other.discharge.id}`).loginAs(lead)
    assert.deepEqual((detail.body().data.truckPool as PoolEntry[])[0].otherHoldings, [])
  })

  test('answers an unknown, active, or closed discharge and a malformed list with refusals', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const { truck } = await createTruck()

    const unknown = await client
      .post(url('00000000-0000-4000-8000-000000000000'))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)
    unknown.assertStatus(404)
    assert.equal(unknown.body().error.code, 'E_DISCHARGE_NOT_FOUND')

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge } = await createPreparedDischarge(status)
      await reserveTruck(discharge, truck, { released: status === 'CLOSED' })
      const before = await truckPoolRows(discharge.id)

      const response = await client
        .post(url(discharge.id))
        .json({ truckIds: [truck.id] })
        .loginAs(lead)

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.deepEqual(await truckPoolRows(discharge.id), before)
    }

    const { discharge } = await createPreparedDischarge()
    const malformed = await client.post(url(discharge.id)).json({ truckIds: [] }).loginAs(lead)
    malformed.assertStatus(422)
  })
})
