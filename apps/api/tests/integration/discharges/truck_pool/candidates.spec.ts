import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

import {
  createPreparedDischarge,
  createTruck,
  PREPARING_ROLES,
  preparer,
  reserveTruck,
} from '../preparation/preparation_scenario.ts'

type Candidate = {
  id: string
  registration: string
  transportCompany: { id: string; name: string }
  otherHoldings: Array<{ dischargeId: string; vesselName: string; status: string }>
}

const url = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/truck-pool/candidates`

test.group('Truck pool candidates HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ client }) => {
    const { discharge } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    ;(await client.get(url(discharge.id))).assertStatus(401)
    ;(await client.get(url(discharge.id)).loginAs(pending)).assertStatus(401)
    ;(await client.get(url(discharge.id)).loginAs(observer)).assertStatus(403)
  })

  test('offers the available trucks the discharge does not hold, with their other holders', async ({
    assert,
    client,
  }) => {
    const { truck: zulu, company } = await createTruck()
    await zulu.merge({ registration: 'ZZ-900-ZZ' }).save()
    const { truck: alpha } = await createTruck()
    await alpha.merge({ registration: 'aa-100-aa' }).save()
    const { truck: held } = await createTruck()
    const { truck: released } = await createTruck()
    const { truck: archived } = await createTruck('ARCHIVED')
    const { truck: suspended } = await createTruck('SUSPENDED')
    const planned = await createPreparedDischarge('PLANNED')
    const active = await createPreparedDischarge('ACTIVE')
    const closed = await createPreparedDischarge('CLOSED')
    const otherPlanned = await createPreparedDischarge('PLANNED')
    await active.discharge.merge({ vesselName: 'MV Active Holder' }).save()
    await otherPlanned.discharge.merge({ vesselName: 'MV Planned Holder' }).save()
    await reserveTruck(planned.discharge, held)
    await reserveTruck(planned.discharge, released, { released: true })
    await reserveTruck(otherPlanned.discharge, zulu)
    await reserveTruck(active.discharge, zulu)
    await reserveTruck(closed.discharge, alpha)
    await company.merge({ name: 'Renamed Transports' }).save()

    for (const role of PREPARING_ROLES) {
      const response = await client.get(url(planned.discharge.id)).loginAs(await preparer(role))

      response.assertStatus(200)
      const candidates = response.body().data as Candidate[]
      const ids = candidates.map((candidate) => candidate.id)

      assert.includeMembers(ids, [zulu.id, alpha.id, released.id])
      assert.notIncludeMembers(ids, [held.id, archived.id, suspended.id])
      assert.isBelow(ids.indexOf(alpha.id), ids.indexOf(zulu.id))

      const offeredZulu = candidates.find((candidate) => candidate.id === zulu.id)
      assert.equal(offeredZulu?.transportCompany.name, 'Renamed Transports')
      assert.deepEqual(offeredZulu?.otherHoldings, [
        { dischargeId: active.discharge.id, vesselName: 'MV Active Holder', status: 'ACTIVE' },
        {
          dischargeId: otherPlanned.discharge.id,
          vesselName: 'MV Planned Holder',
          status: 'PLANNED',
        },
      ])
      assert.deepEqual(candidates.find((candidate) => candidate.id === alpha.id)?.otherHoldings, [])
    }
  })

  test('answers an unknown, malformed, active, or closed discharge with its refusal', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const active = await createPreparedDischarge('ACTIVE')
    const closed = await createPreparedDischarge('CLOSED')

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client.get(url(id)).loginAs(lead)
      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
    for (const { discharge } of [active, closed]) {
      const response = await client.get(url(discharge.id)).loginAs(lead)
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
    }
  })
})
