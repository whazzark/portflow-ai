import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DockFactory } from '#database/factories/dock_factory'
import { UserFactory } from '#database/factories/user_factory'
import Discharge from '#models/discharge'
import Dock from '#models/dock'
import ProductLot from '#models/product_lot'
import Shift from '#models/shift'

import { createPreparedDischarge, PREPARING_ROLES, preparer } from './preparation_scenario.ts'

function identityBody(dockId: string) {
  return {
    vesselName: '  MV Corrected  ',
    vesselImo: '  ',
    vesselComment: 'Delayed by weather',
    dockId,
    expectedStartAt: '2026-10-02T08:30:00.000+02:00',
  }
}

async function snapshot(dischargeId: string) {
  const discharge = await Discharge.findOrFail(dischargeId)
  const lots = await ProductLot.query().where('dischargeId', dischargeId).orderBy('id')
  const shifts = await Shift.query().where('dischargeId', dischargeId).orderBy('id')

  return {
    status: discharge.status,
    vesselName: discharge.vesselName,
    dockId: discharge.dockId,
    lots: lots.map((lot) => [lot.id, lot.customerId, lot.expectedQuantityTonnes.toFixed(3)]),
    shifts: shifts.map((shift) => [shift.id, shift.plannedStartAt.toMillis()]),
  }
}

test.group('Discharge identity correction HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated and non-active requests', async ({ assert, client }) => {
    const { discharge, dock } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const before = await snapshot(discharge.id)

    const unauthenticated = await client
      .patch(`/api/v1/discharges/${discharge.id}`)
      .json(identityBody(dock.id))
    const nonActive = await client
      .patch(`/api/v1/discharges/${discharge.id}`)
      .loginAs(pending)
      .json(identityBody(dock.id))

    unauthenticated.assertStatus(401)
    nonActive.assertStatus(401)
    assert.deepEqual(await snapshot(discharge.id), before)
  })

  test('rejects an observer without changing the discharge', async ({ assert, client }) => {
    const { discharge, dock } = await createPreparedDischarge()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await snapshot(discharge.id)

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}`)
      .loginAs(observer)
      .json(identityBody(dock.id))

    response.assertStatus(403)
    assert.equal(response.body().error.code, 'E_AUTHORIZATION_FAILURE')
    assert.deepEqual(await snapshot(discharge.id), before)
  })

  test('corrects the identity for every preparing role, leaving lots and shifts alone', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge } = await createPreparedDischarge()
      const otherDock = await DockFactory.merge({ name: `Quai ${role}` }).create()
      const before = await snapshot(discharge.id)

      const response = await client
        .patch(`/api/v1/discharges/${discharge.id}`)
        .loginAs(await preparer(role))
        .json(identityBody(otherDock.id))

      response.assertStatus(200)
      const data = response.body().data
      assert.equal(data.vesselName, 'MV Corrected')
      assert.isNull(data.vesselImo)
      assert.equal(data.vesselComment, 'Delayed by weather')
      assert.equal(data.dock.id, otherDock.id)
      assert.equal(
        DateTime.fromISO(data.expectedStartAt).toMillis(),
        DateTime.fromISO('2026-10-02T06:30:00.000Z').toMillis(),
      )
      assert.equal(data.status, 'PLANNED')
      const after = await snapshot(discharge.id)
      assert.deepEqual(after.lots, before.lots)
      assert.deepEqual(after.shifts, before.shifts)
    }
  })

  test('answers not found for an unknown or malformed discharge', async ({ assert, client }) => {
    const { dock } = await createPreparedDischarge()
    const lead = await preparer()

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client
        .patch(`/api/v1/discharges/${id}`)
        .loginAs(lead)
        .json(identityBody(dock.id))

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
  })

  test('refuses to correct an active or closed discharge', async ({ assert, client }) => {
    const lead = await preparer()

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge, dock } = await createPreparedDischarge(status)
      const before = await snapshot(discharge.id)

      const response = await client
        .patch(`/api/v1/discharges/${discharge.id}`)
        .loginAs(lead)
        .json(identityBody(dock.id))

      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      assert.deepEqual(await snapshot(discharge.id), before)
    }
  })

  test('rejects an incomplete body and a newly chosen archived dock', async ({
    assert,
    client,
  }) => {
    const { discharge, dock } = await createPreparedDischarge()
    const archivedDock = await DockFactory.apply('archived').create()
    const lead = await preparer()
    const before = await snapshot(discharge.id)
    const { vesselImo: _omitted, ...withoutImo } = identityBody(dock.id)

    for (const [body, field] of [
      [withoutImo, 'vesselImo'],
      [{ ...identityBody(dock.id), vesselName: '   ' }, 'vesselName'],
      [identityBody(archivedDock.id), 'dockId'],
    ] as const) {
      const response = await client
        .patch(`/api/v1/discharges/${discharge.id}`)
        .loginAs(lead)
        .json(body)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.include(
        response.body().error.details.map((detail: { field: string }) => detail.field),
        field,
      )
    }
    assert.deepEqual(await snapshot(discharge.id), before)
  })

  test('keeps the current dock without checking it again', async ({ assert, client }) => {
    const { discharge, dock } = await createPreparedDischarge()
    // Archived behind the application's back: a dock in use cannot be archived through it.
    await Dock.query().where('id', dock.id).update({ status: 'ARCHIVED' })

    const response = await client
      .patch(`/api/v1/discharges/${discharge.id}`)
      .loginAs(await preparer())
      .json(identityBody(dock.id))

    response.assertStatus(200)
    assert.equal(response.body().data.dock.id, dock.id)
  })
})
