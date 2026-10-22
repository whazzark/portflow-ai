import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'
import { USER_ROLES } from '#models/user'

const ROUTE = '/api/v1/discharges/dock-occupancy'

async function occupiedDock(vesselName = 'MV Nordic Breeze') {
  const dock = await DockFactory.create()
  const discharge = await DischargeFactory.apply('active')
    .merge({ dockId: dock.id, vesselName })
    .create()
  const responsible = await UserFactory.apply('active').create()
  await ShiftFactory.merge({
    dischargeId: discharge.id,
    responsibleUserId: responsible.id,
    plannedStartAt: DateTime.utc(2026, 9, 18, 6),
    plannedEndAt: DateTime.utc(2026, 9, 20, 14),
  }).create()

  return { dock, discharge }
}

test.group('Dock occupancy HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('denies unauthenticated and non-active access without disclosing any vessel', async ({
    assert,
    client,
  }) => {
    const { dock } = await occupiedDock('MV Confidential')
    const pending = await UserFactory.merge({ role: 'OPERATIONS_ADMIN' }).create()

    const unauthenticated = await client.get(ROUTE).qs({ dockId: dock.id })
    const nonActive = await client.get(ROUTE).qs({ dockId: dock.id }).loginAs(pending)

    // The auth middleware refuses a session whose user is not ACTIVE before any policy runs.
    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
    assert.notInclude(JSON.stringify(unauthenticated.body()), 'MV Confidential')
    assert.notInclude(JSON.stringify(nonActive.body()), 'MV Confidential')
  })

  test('serves every active role', async ({ assert, client }) => {
    const { dock, discharge } = await occupiedDock()

    for (const role of USER_ROLES) {
      const user = await UserFactory.apply('active').merge({ role }).create()
      const response = await client.get(ROUTE).qs({ dockId: dock.id }).loginAs(user)

      response.assertStatus(200)
      assert.deepEqual(
        response.body().data.map((item: { discharge: { id: string } }) => item.discharge.id),
        [discharge.id],
        `expected ${role} to read the occupancy`,
      )
    }
  })

  test('refuses a missing or malformed dock identity', async ({ assert, client }) => {
    const user = await UserFactory.apply('active').create()

    const missing = await client.get(ROUTE).loginAs(user)
    const malformed = await client.get(ROUTE).qs({ dockId: 'not-a-uuid' }).loginAs(user)

    for (const response of [missing, malformed]) {
      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.deepEqual(
        response.body().error.details.map((detail: { field: string }) => detail.field),
        ['dockId'],
      )
    }
  })

  test('answers the contract shape, and nothing for an unknown dock', async ({
    assert,
    client,
  }) => {
    const { dock, discharge } = await occupiedDock()
    const user = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()

    const response = await client.get(ROUTE).qs({ dockId: dock.id }).loginAs(user)
    const unknown = await client
      .get(ROUTE)
      .qs({ dockId: '00000000-0000-4000-8000-000000000000' })
      .loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(response.body().data, [
      {
        discharge: { id: discharge.id, vesselName: 'MV Nordic Breeze', status: 'ACTIVE' },
        startAt: '2026-09-18T06:00:00.000Z',
        endAt: '2026-09-20T14:00:00.000Z',
      },
    ])
    unknown.assertStatus(200)
    assert.deepEqual(unknown.body().data, [])
  })
})
