import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import Shift from '#models/shift'

import {
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from '../preparation/preparation_scenario.ts'
import { createStartableDischarge, planRows, startRows } from './start_scenario.ts'

const url = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/start`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

test.group('Discharge start HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests without starting', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createStartableDischarge()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await startRows(discharge.id)

    ;(await client.post(url(discharge.id))).assertStatus(401)
    for (const role of PREPARING_ROLES) {
      for (const accessStatus of ['PENDING', 'DEACTIVATED'] as const) {
        const user = await UserFactory.merge({ accessStatus, role }).create()
        ;(await client.post(url(discharge.id)).loginAs(user)).assertStatus(401)
      }
    }
    ;(await client.post(url(discharge.id)).loginAs(observer)).assertStatus(403)

    assert.deepEqual(await startRows(discharge.id), before)
  })

  test('starts the discharge and its first shift together for every preparing role', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, shift, laterShift } = await createStartableDischarge()
      const user = await preparer(role)
      const plan = await planRows(discharge.id)
      const before = DateTime.utc().startOf('second')

      const response = await client.post(url(discharge.id)).loginAs(user)

      response.assertStatus(200)
      const data = response.body().data
      const actor = { id: user.id, firstName: user.firstName, lastName: user.lastName }
      const started = data.shifts.find((served: { id: string }) => served.id === shift.id)
      const later = data.shifts.find((served: { id: string }) => served.id === laterShift.id)

      assert.equal(data.status, 'ACTIVE')
      assert.deepEqual(data.startedBy, actor)
      assert.equal(started.status, 'ACTIVE')
      assert.deepEqual(started.startedBy, actor)
      assert.equal(started.actualStartAt, data.startedAt)
      assert.isAtLeast(DateTime.fromISO(data.startedAt).toMillis(), before.toMillis())
      assert.equal(DateTime.fromISO(data.startedAt).millisecond, 0)
      assert.equal(later.status, 'PLANNED')
      assert.isNull(later.actualStartAt)

      // The plan becomes effective through the statuses alone: no row of it is written.
      assert.deepEqual(await planRows(discharge.id), plan)
      const stored = await startRows(discharge.id)
      assert.equal(stored.startedByUserId, user.id)
      assert.equal(stored.shifts.find((row) => row.id === shift.id)?.startedByUserId, user.id)
    }
  })

  test('starts the planned shift planned earliest, whatever its sequence', async ({
    assert,
    client,
  }) => {
    const { discharge, shift, laterShift } = await createStartableDischarge()
    // The second shift is moved before the first one, keeping its sequence.
    await Shift.query()
      .where('id', laterShift.id)
      .update({
        plannedStartAt: shift.plannedStartAt.minus({ hours: 10 }).toSQL({ includeOffset: false }),
        plannedEndAt: shift.plannedStartAt.minus({ hours: 2 }).toSQL({ includeOffset: false }),
      })

    const check = await client
      .get(`/api/v1/discharges/${discharge.id}/start-check`)
      .loginAs(await preparer())

    check.assertStatus(200)
    assert.equal(check.body().data.shiftId, laterShift.id)
  })

  test('answers an unknown or malformed identity with the discharge not-found code', async ({
    client,
  }) => {
    const user = await preparer()

    for (const id of [UNKNOWN_ID, 'not-a-uuid']) {
      const response = await client.post(url(id)).loginAs(user)

      response.assertStatus(404)
      response.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_FOUND' } })
    }
  })

  test('starts a discharge once, and never an active or closed one', async ({ assert, client }) => {
    const { discharge } = await createStartableDischarge()
    const user = await preparer()

    ;(await client.post(url(discharge.id)).loginAs(user)).assertStatus(200)
    const started = await startRows(discharge.id)
    const replay = await client.post(url(discharge.id)).loginAs(user)

    replay.assertStatus(409)
    replay.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_PLANNED' } })
    assert.deepEqual(await startRows(discharge.id), started)

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge: other } = await createPreparedDischarge(status)
      const before = await startRows(other.id)
      const response = await client.post(url(other.id)).loginAs(user)

      response.assertStatus(409)
      response.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_PLANNED' } })
      assert.deepEqual(await startRows(other.id), before)
    }
  })
})
