import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import Discharge from '#models/discharge'

import { createPlanningReferences, preparer } from '../preparation/preparation_scenario.ts'
import {
  additionBody,
  addUrl,
  at,
  issuesOf,
  preparedWithShift,
  storedShifts,
} from './add_shift_scenario.ts'

/**
 * Not wrapped in a global transaction: concurrent requests must each run their own, so the discharge's
 * lock is what orders them. Every test builds its own discharge, so none reads another's rows.
 */
test.group('Planned shift addition under concurrency', () => {
  test('adds only one of two overlapping shifts submitted at once', async ({ assert, client }) => {
    const prepared = await preparedWithShift()
    const [left, right] = [await preparer(), await preparer('OPERATIONS_ADMIN')]
    const overlapping = { plannedStartAt: at(14).toISO(), plannedEndAt: at(22).toISO() }

    const responses = await Promise.all([
      client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared, overlapping))
        .loginAs(left),
      client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared, { ...overlapping, plannedStartAt: at(16).toISO() }))
        .loginAs(right),
    ])

    assert.deepEqual(responses.map((response) => response.status()).sort(), [201, 422])
    const refused = responses.find((response) => response.status() === 422)
    assert.deepEqual(refused && issuesOf(refused), [['plannedStartAt', 'shiftOverlap']])
    const shifts = await storedShifts(prepared.discharge.id)
    assert.lengthOf(shifts, 2)
    assert.deepEqual(
      shifts.map((shift) => shift.sequence),
      [1, 2],
    )
  })

  test('adds one shift when the same addition is submitted twice at once', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const addition = additionBody(prepared)

    const responses = await Promise.all([
      client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead),
      client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead),
    ])

    assert.deepEqual(responses.map((response) => response.status()).sort(), [200, 201])
    assert.lengthOf(await storedShifts(prepared.discharge.id), 2)
  })

  test('judges an addition on the discharge and responsible as they are when it is saved', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const { north } = await createPlanningReferences()

    const started = await preparedWithShift()
    await Discharge.query().where('id', started.discharge.id).update({ status: 'ACTIVE' })
    const withResources = await client
      .post(addUrl(started.discharge.id))
      .json(
        additionBody(started, {
          plannedStartAt: at(14).toISO(),
          plannedEndAt: at(22).toISO(),
          weighingAreaIds: [north.id],
        }),
      )
      .loginAs(lead)
    withResources.assertStatus(409)
    assert.equal(withResources.body().error.code, 'E_DISCHARGE_NOT_PLANNED')

    const prepared = await preparedWithShift()
    const responsible = await UserFactory.apply('active')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    await responsible.merge({ accessStatus: 'DEACTIVATED' }).save()
    const ineligible = await client
      .post(addUrl(prepared.discharge.id))
      .json(additionBody(prepared, { responsibleUserId: responsible.id }))
      .loginAs(lead)
    ineligible.assertStatus(422)
    assert.deepEqual(issuesOf(ineligible), [['responsibleUserId', 'eligibleShiftResponsible']])
  })

  test('still answers a replay once the discharge has closed', async ({ assert, client }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const addition = additionBody(prepared)

    ;(await client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead)).assertStatus(
      201,
    )
    await Discharge.query().where('id', prepared.discharge.id).update({ status: 'CLOSED' })

    const replay = await client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead)

    replay.assertStatus(200)
    assert.lengthOf(await storedShifts(prepared.discharge.id), 2)
  })
})
