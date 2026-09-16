import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { ShiftFactory } from '#database/factories/shift_factory'
import {
  ShiftWarehouseDoorFactory,
  ShiftWeighingAreaFactory,
} from '#database/factories/shift_resource_membership_factories'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'
import Discharge from '#models/discharge'
import Shift from '#models/shift'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import User from '#models/user'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

import {
  assignDoorToLot,
  createPreparedDischarge,
  createTruck,
  PREPARING_ROLES,
  preparer,
  reserveTruck,
  selectShiftTruck,
  shiftTruckRows,
} from '../preparation/preparation_scenario.ts'

const url = (dischargeId: string, shiftId: string) =>
  `/api/v1/discharges/${dischargeId}/shifts/${shiftId}`

const at = (hour: number, day = 20) => DateTime.utc(2026, 10, day, hour)

type Issue = { field: string; rule: string; message: string }

/** A prepared discharge whose one shift runs from 06:00 to 14:00, the period every test moves. */
async function plannedShift(status: Parameters<typeof createPreparedDischarge>[0] = 'PLANNED') {
  const prepared = await createPreparedDischarge(status)
  await prepared.shift.merge({ plannedStartAt: at(6), plannedEndAt: at(14) }).save()

  return prepared
}

/** A door of its own warehouse, the door or its warehouse archived when a test needs it. */
async function createDoor({
  archived = false,
  warehouseArchived = false,
}: {
  archived?: boolean
  warehouseArchived?: boolean
} = {}) {
  const warehouse = await (warehouseArchived
    ? WarehouseFactory.apply('archived')
    : WarehouseFactory
  ).create()
  const builder = WarehouseDoorFactory.merge({ warehouseId: warehouse.id })

  return (archived || warehouseArchived ? builder.apply('archived') : builder).create()
}

/**
 * A door a lot of the discharge holds, which is what a shift may newly select: the assignment is
 * what the selection rule reads, so every door a test selects legitimately carries one.
 */
async function createAssignedDoor(
  prepared: Awaited<ReturnType<typeof plannedShift>>,
  options: Parameters<typeof createDoor>[0] = {},
) {
  const door = await createDoor(options)
  await assignDoorToLot(prepared, prepared.wheat.id, door.id)

  return door
}

function createArea({ archived = false }: { archived?: boolean } = {}) {
  return (archived ? WeighingAreaFactory.apply('archived') : WeighingAreaFactory).create()
}

/** Selects a door or weighing area for a shift from a fixed instant, as a past correction would. */
function selectShiftDoor(shift: Shift, warehouseDoorId: string) {
  return ShiftWarehouseDoorFactory.merge({
    shiftId: shift.id,
    warehouseDoorId,
    effectiveFrom: DateTime.utc(2026, 8, 1, 6),
  }).create()
}

function selectShiftArea(shift: Shift, weighingAreaId: string) {
  return ShiftWeighingAreaFactory.merge({
    shiftId: shift.id,
    weighingAreaId,
    effectiveFrom: DateTime.utc(2026, 8, 1, 6),
  }).create()
}

/** A shift's door and weighing area rows as stored. */
async function shiftResourceRows(shiftId: string) {
  const doors = await ShiftWarehouseDoor.query().where('shiftId', shiftId).orderBy('id')
  const areas = await ShiftWeighingArea.query().where('shiftId', shiftId).orderBy('id')

  return {
    doors: doors.map((row) => ({
      id: row.id,
      resourceId: row.warehouseDoorId,
      effectiveFrom: row.effectiveFrom.toISO(),
    })),
    areas: areas.map((row) => ({
      id: row.id,
      resourceId: row.weighingAreaId,
      effectiveFrom: row.effectiveFrom.toISO(),
    })),
  }
}

async function storedShift(shiftId: string) {
  const shift = await Shift.findOrFail(shiftId)

  return {
    sequence: shift.sequence,
    plannedStartAt: shift.plannedStartAt.toUTC().toISO(),
    plannedEndAt: shift.plannedEndAt.toUTC().toISO(),
    responsibleUserId: shift.responsibleUserId,
  }
}

function body(prepared: { responsible: { id: string } }, overrides: Record<string, unknown> = {}) {
  return {
    plannedStartAt: at(6).toISO(),
    plannedEndAt: at(14).toISO(),
    responsibleUserId: prepared.responsible.id,
    truckIds: [],
    warehouseDoorIds: [],
    weighingAreaIds: [],
    ...overrides,
  }
}

const issuesOf = (response: { body(): { error: { details: Issue[] } } }) =>
  response.body().error.details.map((issue) => [issue.field, issue.rule])

test.group('Planned shift correction HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const moved = body(prepared, { plannedStartAt: at(8).toISO() })
    const before = await storedShift(shift.id)

    ;(await client.put(url(discharge.id, shift.id)).json(moved)).assertStatus(401)
    ;(await client.put(url(discharge.id, shift.id)).json(moved).loginAs(pending)).assertStatus(401)
    ;(await client.put(url(discharge.id, shift.id)).json(moved).loginAs(observer)).assertStatus(403)

    assert.deepEqual(await storedShift(shift.id), before)
  })

  test('corrects the period, responsible, trucks, doors, and weighing areas at once', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const prepared = await plannedShift()
      const { discharge, shift } = prepared
      const { truck: keptTruck } = await createTruck()
      const { truck: removedTruck } = await createTruck()
      const { truck: addedTruck } = await createTruck()
      for (const truck of [keptTruck, removedTruck, addedTruck]) {
        await reserveTruck(discharge, truck)
      }
      const keptTruckRow = await selectShiftTruck(shift, keptTruck)
      await selectShiftTruck(shift, removedTruck)
      const keptDoor = await createAssignedDoor(prepared)
      const removedDoor = await createAssignedDoor(prepared)
      const addedDoor = await createAssignedDoor(prepared)
      const keptDoorRow = await selectShiftDoor(shift, keptDoor.id)
      await selectShiftDoor(shift, removedDoor.id)
      const removedArea = await createArea()
      const addedArea = await createArea()
      await selectShiftArea(shift, removedArea.id)
      const newResponsible = await UserFactory.apply('active')
        .merge({ role: 'OPERATIONS_ADMIN' })
        .create()
      const updatedBefore = (await Discharge.findOrFail(discharge.id)).updatedAt
      const lead = await preparer(role)

      const response = await client
        .put(url(discharge.id, shift.id))
        .json(
          body(prepared, {
            plannedStartAt: '2026-10-20T10:00:00+02:00',
            plannedEndAt: '2026-10-20T18:00:00Z',
            responsibleUserId: newResponsible.id,
            truckIds: [keptTruck.id, addedTruck.id],
            warehouseDoorIds: [addedDoor.id, keptDoor.id],
            weighingAreaIds: [addedArea.id],
          }),
        )
        .loginAs(lead)

      response.assertStatus(200)
      assert.deepEqual(await storedShift(shift.id), {
        sequence: 1,
        plannedStartAt: at(8).toISO(),
        plannedEndAt: at(18).toISO(),
        responsibleUserId: newResponsible.id,
      })

      const trucks = await shiftTruckRows(shift.id)
      assert.sameMembers(
        trucks.map((row) => row.truckId),
        [keptTruck.id, addedTruck.id],
      )
      // A selection stays dated from when it was made, whatever period the shift moves to.
      assert.equal(
        DateTime.fromISO(
          trucks.find((row) => row.id === keptTruckRow.id)?.effectiveFrom ?? '',
        ).toMillis(),
        keptTruckRow.effectiveFrom.toMillis(),
      )

      const { doors, areas } = await shiftResourceRows(shift.id)
      assert.sameMembers(
        doors.map((row) => row.resourceId),
        [keptDoor.id, addedDoor.id],
      )
      assert.equal(
        DateTime.fromISO(
          doors.find((row) => row.id === keptDoorRow.id)?.effectiveFrom ?? '',
        ).toMillis(),
        keptDoorRow.effectiveFrom.toMillis(),
      )
      assert.deepEqual(
        areas.map((row) => row.resourceId),
        [addedArea.id],
      )
      assert.isTrue(
        (await Discharge.findOrFail(discharge.id)).updatedAt.toMillis() >= updatedBefore.toMillis(),
      )

      const detail = response.body().data.shifts[0]
      assert.equal(detail.id, shift.id)
      assert.equal(DateTime.fromISO(detail.plannedStartAt).toMillis(), at(8).toMillis())
      assert.equal(detail.responsible.id, newResponsible.id)
      assert.lengthOf(detail.trucks, 2)
      assert.sameMembers(
        detail.warehouseDoors.map((row: { warehouseDoor: { id: string } }) => row.warehouseDoor.id),
        [keptDoor.id, addedDoor.id],
      )
      assert.deepEqual(
        detail.weighingAreas.map((row: { weighingArea: { id: string } }) => row.weighingArea.id),
        [addedArea.id],
      )
    }
  })

  test('renumbers the shifts when the corrected period changes their order', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift, responsible } = prepared
    const second = await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
      sequence: 2,
      plannedStartAt: at(14),
      plannedEndAt: at(22),
    }).create()
    const third = await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
      sequence: 3,
      plannedStartAt: at(6, 21),
      plannedEndAt: at(14, 21),
    }).create()
    const lead = await preparer()

    const response = await client
      .put(url(discharge.id, shift.id))
      .json(
        body(prepared, { plannedStartAt: at(14, 21).toISO(), plannedEndAt: at(22, 21).toISO() }),
      )
      .loginAs(lead)

    response.assertStatus(200)
    assert.deepEqual(
      [
        (await storedShift(second.id)).sequence,
        (await storedShift(third.id)).sequence,
        (await storedShift(shift.id)).sequence,
      ],
      [1, 2, 3],
    )
    assert.deepEqual(
      response.body().data.shifts.map((row: { id: string }) => row.id),
      [second.id, third.id, shift.id],
    )

    // Back to the front: every shift moves again.
    ;(
      await client
        .put(url(discharge.id, shift.id))
        .json(body(prepared, { plannedStartAt: at(0).toISO(), plannedEndAt: at(6).toISO() }))
        .loginAs(lead)
    ).assertStatus(200)
    assert.deepEqual(
      [
        (await storedShift(shift.id)).sequence,
        (await storedShift(second.id)).sequence,
        (await storedShift(third.id)).sequence,
      ],
      [1, 2, 3],
    )
  })

  test('answers an unknown discharge or shift, and a started one, with their refusals', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const planned = await plannedShift()
    const otherDischarge = await plannedShift()
    const active = await plannedShift('ACTIVE')
    const closed = await plannedShift('CLOSED')
    const startedShift = await ShiftFactory.apply('active')
      .merge({
        dischargeId: planned.discharge.id,
        responsibleUserId: planned.responsible.id,
        sequence: 2,
        plannedStartAt: at(14),
        plannedEndAt: at(22),
      })
      .create()
    const moved = body(planned, {
      plannedStartAt: at(0, 25).toISO(),
      plannedEndAt: at(6, 25).toISO(),
    })

    for (const shiftId of [
      '00000000-0000-4000-8000-000000000000',
      'not-a-uuid',
      otherDischarge.shift.id,
    ]) {
      const response = await client
        .put(url(planned.discharge.id, shiftId))
        .json(moved)
        .loginAs(lead)
      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_SHIFT_NOT_FOUND')
    }

    const unknown = await client
      .put(url('00000000-0000-4000-8000-000000000000', planned.shift.id))
      .json(moved)
      .loginAs(lead)
    unknown.assertStatus(404)
    assert.equal(unknown.body().error.code, 'E_DISCHARGE_NOT_FOUND')

    for (const { discharge, shift } of [active, closed]) {
      const response = await client.put(url(discharge.id, shift.id)).json(moved).loginAs(lead)
      response.assertStatus(409)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
    }

    const notPlanned = await client
      .put(url(planned.discharge.id, startedShift.id))
      .json(moved)
      .loginAs(lead)
    notPlanned.assertStatus(409)
    assert.equal(notPlanned.body().error.code, 'E_SHIFT_NOT_PLANNED')
    assert.equal((await storedShift(startedShift.id)).plannedStartAt, at(14).toISO())
    assert.equal((await storedShift(planned.shift.id)).plannedStartAt, at(6).toISO())
  })

  test('refuses a period that ends before it starts or overlaps another shift', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift, responsible } = prepared
    await ShiftFactory.merge({
      dischargeId: discharge.id,
      responsibleUserId: responsible.id,
      sequence: 2,
      plannedStartAt: at(14),
      plannedEndAt: at(22),
    }).create()
    const lead = await preparer()
    const before = await storedShift(shift.id)

    const reversed = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { plannedStartAt: at(10).toISO(), plannedEndAt: at(10).toISO() }))
      .loginAs(lead)
    reversed.assertStatus(422)
    assert.deepEqual(reversed.body().error.details, [
      {
        field: 'plannedEndAt',
        rule: 'shiftPeriodOrder',
        message: 'The planned end must be after the planned start',
      },
    ])

    const overlapping = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { plannedStartAt: at(8).toISO(), plannedEndAt: at(15).toISO() }))
      .loginAs(lead)
    overlapping.assertStatus(422)
    assert.deepEqual(overlapping.body().error.details, [
      {
        field: 'plannedStartAt',
        rule: 'shiftOverlap',
        message: 'This shift overlaps another shift',
      },
    ])
    assert.deepEqual(await storedShift(shift.id), before)

    // Touching the next shift is no overlap.
    ;(
      await client
        .put(url(discharge.id, shift.id))
        .json(body(prepared, { plannedStartAt: at(8).toISO(), plannedEndAt: at(14).toISO() }))
        .loginAs(lead)
    ).assertStatus(200)
  })

  test('refuses a responsible who cannot be responsible for a shift', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    const lead = await preparer()

    for (const responsibleUserId of [
      observer.id,
      deactivated.id,
      '00000000-0000-4000-8000-000000000000',
    ]) {
      const response = await client
        .put(url(discharge.id, shift.id))
        .json(body(prepared, { responsibleUserId }))
        .loginAs(lead)
      response.assertStatus(422)
      assert.deepEqual(response.body().error.details, [
        {
          field: 'responsibleUserId',
          rule: 'eligibleShiftResponsible',
          message: 'This user can no longer be responsible for a shift',
        },
      ])
    }
    assert.equal((await storedShift(shift.id)).responsibleUserId, prepared.responsible.id)
  })

  test('keeps a responsible who has lost eligibility while the rest of the shift is corrected', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    await User.query()
      .where('id', prepared.responsible.id)
      .update({ accessStatus: 'DEACTIVATED', deactivatedAt: DateTime.utc().toSQL() })

    const response = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { plannedStartAt: at(7).toISO() }))
      .loginAs(await preparer())

    response.assertStatus(200)
    assert.containsSubset(await storedShift(shift.id), {
      plannedStartAt: at(7).toISO(),
      responsibleUserId: prepared.responsible.id,
    })
  })

  test('refuses an available door no product lot of the discharge holds', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    // Available, and belonging to no lot of this discharge: a shift unloads into the doors its
    // cargo was assigned to, so it is refused at the position the form holds it in.
    const unassignedDoor = await createDoor()
    const lead = await preparer()

    const response = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { warehouseDoorIds: [unassignedDoor.id] }))
      .loginAs(lead)

    response.assertStatus(422)
    assert.deepEqual(issuesOf(response), [['warehouseDoorIds.0', 'assignedWarehouseDoor']])
    assert.isEmpty(await ShiftWarehouseDoor.query().where('shiftId', shift.id))
  })

  test('keeps a door already selected once its assignment was withdrawn', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    // Assigned when the selection was made, withdrawn since: taking the selection away is the
    // planner's decision, not this write's.
    const door = await createAssignedDoor(prepared)
    await selectShiftDoor(shift, door.id)
    await WarehouseDoorProductLotAssignment.query()
      .where('warehouseDoorId', door.id)
      .update({ effectiveTo: at(1).toSQL({ includeOffset: false }) })
    const lead = await preparer()

    const response = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { warehouseDoorIds: [door.id] }))
      .loginAs(lead)

    response.assertStatus(200)
    const rows = await ShiftWarehouseDoor.query().where('shiftId', shift.id)
    assert.deepEqual(
      rows.map((row) => row.warehouseDoorId),
      [door.id],
    )
  })

  test('refuses trucks, doors, and weighing areas that cannot be newly selected, all at once', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    const { truck: unheld } = await createTruck()
    const { truck: suspended } = await createTruck('SUSPENDED')
    await reserveTruck(discharge, suspended)
    const archivedDoor = await createDoor({ archived: true })
    const doorOfArchivedWarehouse = await createDoor({ warehouseArchived: true })
    const availableDoor = await createAssignedDoor(prepared)
    const archivedArea = await createArea({ archived: true })
    const lead = await preparer()
    const unknown = '00000000-0000-4000-8000-000000000000'

    const response = await client
      .put(url(discharge.id, shift.id))
      .json(
        body(prepared, {
          plannedStartAt: at(14).toISO(),
          plannedEndAt: at(12).toISO(),
          truckIds: [unheld.id, suspended.id],
          warehouseDoorIds: [
            availableDoor.id,
            archivedDoor.id,
            doorOfArchivedWarehouse.id,
            unknown,
          ],
          weighingAreaIds: [unknown, archivedArea.id],
        }),
      )
      .loginAs(lead)

    response.assertStatus(422)
    assert.deepEqual(issuesOf(response), [
      ['plannedEndAt', 'shiftPeriodOrder'],
      ['truckIds.0', 'heldTruck'],
      ['truckIds.1', 'selectableTruck'],
      ['warehouseDoorIds.1', 'availableWarehouseDoor'],
      ['warehouseDoorIds.2', 'availableWarehouseDoor'],
      ['warehouseDoorIds.3', 'availableWarehouseDoor'],
      ['weighingAreaIds.0', 'availableWeighingArea'],
      ['weighingAreaIds.1', 'availableWeighingArea'],
    ])
    const details = response.body().error.details as Issue[]
    assert.equal(
      details.find((issue) => issue.rule === 'availableWarehouseDoor')?.message,
      'This warehouse door is no longer available',
    )
    assert.equal(
      details.find((issue) => issue.rule === 'availableWeighingArea')?.message,
      'This weighing area is no longer available',
    )
    assert.deepEqual(await shiftTruckRows(shift.id), [])
    assert.deepEqual(await shiftResourceRows(shift.id), { doors: [], areas: [] })
    assert.equal((await storedShift(shift.id)).plannedStartAt, at(6).toISO())
  })

  test('keeps a door or weighing area already selected even once archived', async ({
    assert,
    client,
  }) => {
    const prepared = await plannedShift()
    const { discharge, shift } = prepared
    const archivedDoor = await createDoor({ archived: true })
    const doorOfArchivedWarehouse = await createDoor({ warehouseArchived: true })
    const archivedArea = await createArea({ archived: true })
    await selectShiftDoor(shift, archivedDoor.id)
    await selectShiftDoor(shift, doorOfArchivedWarehouse.id)
    await selectShiftArea(shift, archivedArea.id)
    const lead = await preparer()
    const before = await shiftResourceRows(shift.id)

    const kept = await client
      .put(url(discharge.id, shift.id))
      .json(
        body(prepared, {
          plannedStartAt: at(7).toISO(),
          warehouseDoorIds: [doorOfArchivedWarehouse.id, archivedDoor.id],
          weighingAreaIds: [archivedArea.id],
        }),
      )
      .loginAs(lead)

    kept.assertStatus(200)
    assert.deepEqual(await shiftResourceRows(shift.id), before)

    // Once removed, an archived door can no longer come back.
    ;(
      await client
        .put(url(discharge.id, shift.id))
        .json(body(prepared, { weighingAreaIds: [archivedArea.id] }))
        .loginAs(lead)
    ).assertStatus(200)
    const back = await client
      .put(url(discharge.id, shift.id))
      .json(body(prepared, { warehouseDoorIds: [archivedDoor.id] }))
      .loginAs(lead)
    back.assertStatus(422)
    assert.deepEqual(issuesOf(back), [['warehouseDoorIds.0', 'availableWarehouseDoor']])
  })

  test('refuses a malformed body with the validation shape', async ({ assert, client }) => {
    const prepared = await plannedShift()
    const lead = await preparer()

    const response = await client
      .put(url(prepared.discharge.id, prepared.shift.id))
      .json({ plannedStartAt: '2026-10-20T06:00:00', truckIds: 'x' })
      .loginAs(lead)

    response.assertStatus(422)
    assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
  })
})
