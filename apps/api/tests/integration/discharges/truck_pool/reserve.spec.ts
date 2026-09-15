import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'

import {
  createPreparedDischarge,
  createTruck,
  PREPARING_ROLES,
  preparer,
  reserveTruck,
  shiftTruckRows,
  truckPoolRows,
} from '../preparation/preparation_scenario.ts'

type PoolEntry = {
  id: string
  truckId: string
  registration: string
  transportCompany: { name: string }
  reservedAt: string
  releasedAt: string | null
  otherHoldings: Array<{ dischargeId: string }>
}

const url = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/truck-pool`

test.group('Truck reservation HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck } = await createTruck()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = { truckIds: [truck.id] }

    ;(await client.post(url(discharge.id)).json(body)).assertStatus(401)
    ;(await client.post(url(discharge.id)).json(body).loginAs(pending)).assertStatus(401)
    ;(await client.post(url(discharge.id)).json(body).loginAs(observer)).assertStatus(403)

    assert.deepEqual(await truckPoolRows(discharge.id), [])
  })

  test('reserves several trucks for every preparing role, with the values captured now', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, shift } = await createPreparedDischarge()
      const { truck: first, company } = await createTruck()
      const { truck: second } = await createTruck()

      const response = await client
        .post(url(discharge.id))
        .json({ truckIds: [first.id, second.id] })
        .loginAs(await preparer(role))

      response.assertStatus(200)
      const pool = response.body().data.truckPool as PoolEntry[]
      const reserved = pool.find((entry) => entry.truckId === first.id)
      assert.lengthOf(pool, 2)
      assert.equal(reserved?.registration, first.registration)
      assert.equal(reserved?.transportCompany.name, company.name)
      assert.isNull(reserved?.releasedAt)
      assert.isString(reserved?.reservedAt)
      assert.deepEqual(await shiftTruckRows(shift.id), [])
    }
  })

  test('reserves a truck other planned or active discharges hold, and each names the others', async ({
    assert,
    client,
  }) => {
    const { truck } = await createTruck()
    const planned = await createPreparedDischarge('PLANNED')
    const otherPlanned = await createPreparedDischarge('PLANNED')
    const active = await createPreparedDischarge('ACTIVE')
    await reserveTruck(otherPlanned.discharge, truck)
    await reserveTruck(active.discharge, truck)
    const lead = await preparer()

    const response = await client
      .post(url(planned.discharge.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)

    response.assertStatus(200)
    const [entry] = response.body().data.truckPool as PoolEntry[]
    assert.sameMembers(
      entry.otherHoldings.map((holding) => holding.dischargeId),
      [otherPlanned.discharge.id, active.discharge.id],
    )

    const activeDetail = await client.get(`/api/v1/discharges/${active.discharge.id}`).loginAs(lead)
    assert.include(
      (activeDetail.body().data.truckPool as PoolEntry[])[0].otherHoldings.map(
        (holding) => holding.dischargeId,
      ),
      planned.discharge.id,
    )
  })

  test('replays harmlessly: the same reservation twice holds each truck once', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck } = await createTruck()
    const lead = await preparer()

    await client
      .post(url(discharge.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)
    const before = await truckPoolRows(discharge.id)
    const response = await client
      .post(url(discharge.id))
      .json({ truckIds: [truck.id] })
      .loginAs(lead)

    response.assertStatus(200)
    assert.deepEqual(await truckPoolRows(discharge.id), before)
  })

  test('holds a released truck again on its own row, with values captured again', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck } = await createTruck()
    const released = await reserveTruck(discharge, truck, { released: true })
    await truck.merge({ registration: 'NEW-REG-01' }).save()

    const response = await client
      .post(url(discharge.id))
      .json({ truckIds: [truck.id] })
      .loginAs(await preparer())

    response.assertStatus(200)
    const row = await DischargeTruckAssignment.findOrFail(released.id)
    assert.isNull(row.releasedAt)
    assert.equal(row.registrationSnapshot, 'NEW-REG-01')
    assert.isTrue(row.reservedAt > released.reservedAt)
    assert.lengthOf(await truckPoolRows(discharge.id), 1)
  })

  test('answers an unknown, malformed, active, or closed discharge with its refusal', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const { truck } = await createTruck()
    const body = { truckIds: [truck.id] }

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client.post(url(id)).json(body).loginAs(lead)
      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge } = await createPreparedDischarge(status)
      const response = await client.post(url(discharge.id)).json(body).loginAs(lead)
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.deepEqual(await truckPoolRows(discharge.id), [])
    }
  })

  test('refuses archived or suspended trucks and malformed lists, reserving nothing', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const { truck: free } = await createTruck()
    const { truck: archived } = await createTruck('ARCHIVED')
    const { truck: suspended } = await createTruck('SUSPENDED')
    const lead = await preparer()

    const archivedResponse = await client
      .post(url(discharge.id))
      .json({ truckIds: [free.id, archived.id] })
      .loginAs(lead)
    archivedResponse.assertStatus(422)
    assert.deepInclude(archivedResponse.body().error.details, {
      field: 'truckIds.1',
      rule: 'availableTruck',
      message: 'This truck is no longer available to reserve',
    })

    const suspendedResponse = await client
      .post(url(discharge.id))
      .json({ truckIds: [suspended.id] })
      .loginAs(lead)
    suspendedResponse.assertStatus(422)
    assert.equal(suspendedResponse.body().error.details[0].field, 'truckIds.0')

    for (const truckIds of [[], [free.id, free.id], ['not-a-uuid']]) {
      const response = await client.post(url(discharge.id)).json({ truckIds }).loginAs(lead)
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
    }

    assert.deepEqual(await truckPoolRows(discharge.id), [])
  })
})
