import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { DateTime } from 'luxon'

import { ShiftWeighingAreaFactory } from '#database/factories/shift_resource_membership_factories'
import { UserFactory } from '#database/factories/user_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import Shift from '#models/shift'

import {
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from '../preparation/preparation_scenario.ts'
import { createStartableDischarge, startRows } from './start_scenario.ts'

const url = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/start-check`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

test.group('Discharge start check HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ client }) => {
    const { discharge } = await createStartableDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    ;(await client.get(url(discharge.id))).assertStatus(401)
    ;(await client.get(url(discharge.id)).loginAs(pending)).assertStatus(401)
    ;(await client.get(url(discharge.id)).loginAs(observer)).assertStatus(403)
  })

  test('reports the shift that would start and no problem, changing nothing', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, shift } = await createStartableDischarge()
      const before = await startRows(discharge.id)

      const response = await client.get(url(discharge.id)).loginAs(await preparer(role))

      response.assertStatus(200)
      assert.deepEqual(response.body(), {
        data: { dischargeId: discharge.id, shiftId: shift.id, problems: [] },
      })
      assert.deepEqual(await startRows(discharge.id), before)
    }
  })

  test('reports no shift when the discharge has no planned shift', async ({ assert, client }) => {
    const { discharge, shift } = await createPreparedDischarge()
    await Shift.query().where('id', shift.id).update({ status: 'COMPLETED' })

    const response = await client.get(url(discharge.id)).loginAs(await preparer())

    response.assertStatus(200)
    assert.isNull(response.body().data.shiftId)
  })

  test('lists problems about the shift resources by name, not by identity', async ({
    assert,
    client,
  }) => {
    const { discharge, shift } = await createStartableDischarge()
    const unique = DateTime.now().toMillis()
    // Identities in the opposite order of the names, so an order by identity would show.
    const names = [`alpha ${unique}`, `Bravo ${unique}`, `charlie ${unique}`]
    const areas = []
    for (const [index, name] of names.entries()) {
      areas.push(
        await WeighingAreaFactory.apply('archived')
          .merge({ id: `ffffffff-0000-4000-8000-00000000000${9 - index}`, name })
          .create(),
      )
    }
    for (const area of [...areas].reverse()) {
      await ShiftWeighingAreaFactory.merge({
        shiftId: shift.id,
        weighingAreaId: area.id,
        effectiveFrom: DateTime.utc(2026, 8, 1, 6),
      }).create()
    }

    const response = await client.get(url(discharge.id)).loginAs(await preparer())

    response.assertStatus(200)
    assert.deepEqual(
      response
        .body()
        .data.problems.filter(
          (problem: { code: string }) => problem.code === 'WEIGHING_AREA_ARCHIVED',
        )
        .map((problem: { subject: { id: string } }) => problem.subject.id),
      areas.map((area) => area.id),
    )
  })

  test('answers unknown, active, and closed discharges as the start does', async ({ client }) => {
    const user = await preparer()

    for (const id of [UNKNOWN_ID, 'not-a-uuid']) {
      const response = await client.get(url(id)).loginAs(user)
      response.assertStatus(404)
      response.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_FOUND' } })
    }
    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge } = await createPreparedDischarge(status)
      const response = await client.get(url(discharge.id)).loginAs(user)
      response.assertStatus(409)
      response.assertBodyContains({ error: { code: 'E_DISCHARGE_NOT_PLANNED' } })
    }
  })
})
