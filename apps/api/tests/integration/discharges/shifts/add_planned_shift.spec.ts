import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { UserFactory } from '#database/factories/user_factory'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'

import {
  assignDoorToLot,
  createPlanningReferences,
  createTruck,
  PREPARING_ROLES,
  preparer,
  reserveTruck,
  shiftTruckRows,
  truckPoolRows,
} from '../preparation/preparation_scenario.ts'
import {
  additionBody,
  addUrl,
  at,
  createShift,
  dischargeStatus,
  issuesOf,
  preparedWithShift,
  storedSelections,
  storedShifts,
} from './add_shift_scenario.ts'

test.group('Planned shift addition to a planned discharge', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const prepared = await preparedWithShift()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const before = await storedShifts(prepared.discharge.id)
    const addition = additionBody(prepared)

    ;(await client.post(addUrl(prepared.discharge.id)).json(addition)).assertStatus(401)
    ;(
      await client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(pending)
    ).assertStatus(401)
    const refused = await client
      .post(addUrl(prepared.discharge.id))
      .json(addition)
      .loginAs(observer)
    refused.assertStatus(403)
    assert.notProperty(refused.body(), 'data')

    assert.deepEqual(await storedShifts(prepared.discharge.id), before)
  })

  test('adds a planned shift with its period and responsible, for every preparing role', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const prepared = await preparedWithShift()
      const responsible = await UserFactory.apply('active')
        .merge({ role: 'OPERATIONS_ADMIN' })
        .create()
      const addition = additionBody(prepared, {
        plannedStartAt: '2026-10-20T16:00:00+02:00',
        plannedEndAt: '2026-10-20T22:00:00Z',
        responsibleUserId: responsible.id,
      })

      const response = await client
        .post(addUrl(prepared.discharge.id))
        .json(addition)
        .loginAs(await preparer(role))

      response.assertStatus(201)
      const shifts = await storedShifts(prepared.discharge.id)
      assert.deepEqual(shifts[1], {
        id: addition.id,
        sequence: 2,
        status: 'PLANNED',
        plannedStartAt: at(14).toISO(),
        plannedEndAt: at(22).toISO(),
        responsibleUserId: responsible.id,
      })
      assert.deepEqual(await storedSelections(prepared.discharge.id), {
        trucks: [],
        doors: [],
        areas: [],
      })

      const detail = response.body().data
      assert.equal(detail.status, 'PLANNED')
      assert.deepEqual(
        detail.shifts.map((shift: { id: string }) => shift.id),
        [prepared.shift.id, addition.id],
      )
      assert.equal(detail.shifts[1].responsible.id, responsible.id)
    }
  })

  test('selects the trucks, doors, and weighing areas the shift starts with', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const { truck } = await createTruck()
    await reserveTruck(prepared.discharge, truck)
    const { doorA1, north } = await createPlanningReferences()
    await assignDoorToLot(prepared, prepared.wheat.id, doorA1.id)
    const addition = additionBody(prepared, {
      truckIds: [truck.id],
      warehouseDoorIds: [doorA1.id],
      weighingAreaIds: [north.id],
    })

    const response = await client
      .post(addUrl(prepared.discharge.id))
      .json(addition)
      .loginAs(await preparer())

    response.assertStatus(201)
    const trucks = await shiftTruckRows(addition.id)
    assert.deepEqual(
      trucks.map((row) => [row.truckId, row.effectiveTo]),
      [[truck.id, null]],
    )
    const door = await ShiftWarehouseDoor.query().where('shiftId', addition.id).firstOrFail()
    assert.equal(door.warehouseDoorId, doorA1.id)
    assert.isNull(door.effectiveTo)
    const area = await ShiftWeighingArea.query().where('shiftId', addition.id).firstOrFail()
    assert.equal(area.weighingAreaId, north.id)
    assert.isNull(area.effectiveTo)

    const added = response.body().data.shifts[1]
    assert.equal(added.trucks[0].truckId, truck.id)
    assert.equal(added.warehouseDoors[0].warehouseDoor.id, doorA1.id)
    assert.equal(added.weighingAreas[0].weighingArea.id, north.id)
  })

  test('numbers the shifts by planned start wherever the new one is placed', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()

    for (const [start, end, expectedOrder] of [
      [at(0), at(6), ['new', 'first', 'last']],
      [at(14), at(20), ['first', 'new', 'last']],
      [at(0, 22), at(6, 22), ['first', 'last', 'new']],
    ] as const) {
      const prepared = await preparedWithShift()
      const last = await createShift(prepared, 2, at(6, 21), at(14, 21))
      const addition = additionBody(prepared, {
        plannedStartAt: start.toISO(),
        plannedEndAt: end.toISO(),
      })
      const names = new Map([
        [prepared.shift.id, 'first'],
        [last.id, 'last'],
        [addition.id, 'new'],
      ])

      const response = await client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead)

      response.assertStatus(201)
      const shifts = await storedShifts(prepared.discharge.id)
      assert.deepEqual(
        shifts.map((shift) => names.get(shift.id)),
        [...expectedOrder],
      )
      assert.deepEqual(
        shifts.map((shift) => shift.sequence),
        [1, 2, 3],
      )
      assert.deepEqual(
        response.body().data.shifts.map((shift: { id: string }) => names.get(shift.id)),
        [...expectedOrder],
      )
    }
  })

  test('accepts a period in the past and one that only touches its neighbours', async ({
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const past = DateTime.utc(2024, 1, 10, 6)

    ;(
      await client
        .post(addUrl(prepared.discharge.id))
        .json(
          additionBody(prepared, {
            plannedStartAt: past.toISO(),
            plannedEndAt: past.plus({ hours: 8 }).toISO(),
          }),
        )
        .loginAs(lead)
    ).assertStatus(201)
    ;(
      await client
        .post(addUrl(prepared.discharge.id))
        .json(
          additionBody(prepared, { plannedStartAt: at(0).toISO(), plannedEndAt: at(6).toISO() }),
        )
        .loginAs(lead)
    ).assertStatus(201)
  })

  test('answers a replay of the same addition with the discharge, adding nothing', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const addition = additionBody(prepared)

    ;(await client.post(addUrl(prepared.discharge.id)).json(addition).loginAs(lead)).assertStatus(
      201,
    )
    const replay = await client
      .post(addUrl(prepared.discharge.id))
      .json({ ...addition, id: addition.id.toUpperCase() })
      .loginAs(lead)

    replay.assertStatus(200)
    assert.lengthOf(await storedShifts(prepared.discharge.id), 2)
    assert.lengthOf(replay.body().data.shifts, 2)
  })

  test('leaves the discharge, its pool, and its other shifts as they were', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const { truck } = await createTruck()
    await reserveTruck(prepared.discharge, truck)
    const poolBefore = await truckPoolRows(prepared.discharge.id)
    const shiftsBefore = await storedShifts(prepared.discharge.id)

    ;(
      await client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared))
        .loginAs(await preparer())
    ).assertStatus(201)

    assert.equal(await dischargeStatus(prepared.discharge.id), 'PLANNED')
    assert.deepEqual(await truckPoolRows(prepared.discharge.id), poolBefore)
    assert.deepEqual((await storedShifts(prepared.discharge.id))[0], shiftsBefore[0])
    assert.deepEqual((await storedSelections(prepared.discharge.id)).trucks, [])
  })
})

test.group('Planned shift addition to an active discharge', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  /** An active discharge with a completed shift, then its active one from 06:00 to 14:00. */
  async function underWay() {
    const prepared = await preparedWithShift('ACTIVE')
    await prepared.shift.merge({ sequence: 2 }).save()
    const completed = await createShift(prepared, 1, at(22, 19), at(6), 'COMPLETED')

    return { ...prepared, completed }
  }

  test('adds a planned shift after the started ones, with no resource', async ({
    assert,
    client,
  }) => {
    const prepared = await underWay()
    const before = await storedShifts(prepared.discharge.id)
    const addition = additionBody(prepared)

    const response = await client
      .post(addUrl(prepared.discharge.id))
      .json(addition)
      .loginAs(await preparer())

    response.assertStatus(201)
    const shifts = await storedShifts(prepared.discharge.id)
    assert.deepEqual(shifts.slice(0, 2), before)
    assert.deepInclude(shifts[2], { id: addition.id, sequence: 3, status: 'PLANNED' })
    assert.deepEqual(await storedSelections(prepared.discharge.id), {
      trucks: [],
      doors: [],
      areas: [],
    })
    assert.equal(await dischargeStatus(prepared.discharge.id), 'ACTIVE')
  })

  test('adds a planned shift between two planned shifts that follow the active one', async ({
    assert,
    client,
  }) => {
    const prepared = await underWay()
    const later = await createShift(prepared, 3, at(6, 21), at(14, 21))
    const addition = additionBody(prepared, {
      plannedStartAt: at(14).toISO(),
      plannedEndAt: at(22).toISO(),
    })

    ;(
      await client
        .post(addUrl(prepared.discharge.id))
        .json(addition)
        .loginAs(await preparer())
    ).assertStatus(201)

    const shifts = await storedShifts(prepared.discharge.id)
    assert.deepEqual(
      shifts.map((shift) => [shift.id, shift.sequence]),
      [
        [prepared.completed.id, 1],
        [prepared.shift.id, 2],
        [addition.id, 3],
        [later.id, 4],
      ],
    )
  })

  test('refuses a shift starting with or before the active shift', async ({ assert, client }) => {
    const prepared = await underWay()
    const lead = await preparer()
    const before = await storedShifts(prepared.discharge.id)

    for (const [start, end] of [
      [at(6), at(7)],
      [at(0, 18), at(6, 18)],
    ]) {
      const response = await client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared, { plannedStartAt: start.toISO(), plannedEndAt: end.toISO() }))
        .loginAs(lead)

      response.assertStatus(422)
      assert.deepInclude(issuesOf(response), ['plannedStartAt', 'shiftAfterStartedShifts'])
    }
    assert.deepEqual(await storedShifts(prepared.discharge.id), before)
  })
})
