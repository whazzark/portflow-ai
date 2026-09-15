import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import type User from '#models/user'

import {
  createPreparedDischarge,
  createTruck,
  preparer,
  reserveTruck,
} from '../preparation/preparation_scenario.ts'

type PoolEntry = {
  truckId: string
  releasedAt: string | null
  otherHoldings: Array<{ dischargeId: string; vesselName: string; status: string }>
}

async function poolOf(client: ApiClient, dischargeId: string, user: User) {
  const response = await client.get(`/api/v1/discharges/${dischargeId}`).loginAs(user)
  response.assertStatus(200)

  return response.body().data.truckPool as PoolEntry[]
}

test.group('Discharge detail other truck holdings', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('names every other planned or active discharge holding a held truck, active first', async ({
    assert,
    client,
  }) => {
    const { truck } = await createTruck()
    const { truck: alone } = await createTruck()
    const a = await createPreparedDischarge('PLANNED')
    const b = await createPreparedDischarge('PLANNED')
    const c = await createPreparedDischarge('ACTIVE')
    const d = await createPreparedDischarge('CLOSED')
    await a.discharge.merge({ vesselName: 'MV Alpha' }).save()
    await b.discharge.merge({ vesselName: 'MV Bravo' }).save()
    await c.discharge.merge({ vesselName: 'MV Zulu' }).save()
    await reserveTruck(a.discharge, truck)
    await reserveTruck(a.discharge, alone)
    await reserveTruck(b.discharge, truck)
    await reserveTruck(c.discharge, truck)
    await reserveTruck(d.discharge, truck, { released: true })
    const lead = await preparer()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const expected = [
      { dischargeId: c.discharge.id, vesselName: 'MV Zulu', status: 'ACTIVE' },
      { dischargeId: b.discharge.id, vesselName: 'MV Bravo', status: 'PLANNED' },
    ]
    for (const user of [lead, observer]) {
      const pool = await poolOf(client, a.discharge.id, user)

      assert.deepEqual(pool.find((entry) => entry.truckId === truck.id)?.otherHoldings, expected)
      assert.deepEqual(pool.find((entry) => entry.truckId === alone.id)?.otherHoldings, [])
    }

    const activePool = await poolOf(client, c.discharge.id, lead)
    assert.deepEqual(activePool.find((entry) => entry.truckId === truck.id)?.otherHoldings, [
      { dischargeId: a.discharge.id, vesselName: 'MV Alpha', status: 'PLANNED' },
      { dischargeId: b.discharge.id, vesselName: 'MV Bravo', status: 'PLANNED' },
    ])
  })

  test('never names holdings on a released entry or on a closed discharge', async ({
    assert,
    client,
  }) => {
    const { truck } = await createTruck()
    const planned = await createPreparedDischarge('PLANNED')
    const holder = await createPreparedDischarge('PLANNED')
    const closed = await createPreparedDischarge('CLOSED')
    await reserveTruck(planned.discharge, truck, { released: true })
    await reserveTruck(holder.discharge, truck)
    await reserveTruck(closed.discharge, truck)
    const lead = await preparer()

    const plannedPool = await poolOf(client, planned.discharge.id, lead)
    assert.isNotNull(plannedPool[0].releasedAt)
    assert.deepEqual(plannedPool[0].otherHoldings, [])

    const closedPool = await poolOf(client, closed.discharge.id, lead)
    assert.deepEqual(closedPool[0].otherHoldings, [])
  })
})
