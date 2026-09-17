import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'

import {
  assignDoorToLot,
  createPlanningReferences,
  createTruck,
  preparer,
  reserveTruck,
} from '../preparation/preparation_scenario.ts'
import {
  additionBody,
  addUrl,
  at,
  issuesOf,
  type Prepared,
  preparedWithShift,
  storedSelections,
  storedShifts,
} from './add_shift_scenario.ts'

/** Whatever a refused addition sent, the discharge's shifts and selections are as they were. */
async function snapshot(prepared: Prepared) {
  return {
    shifts: await storedShifts(prepared.discharge.id),
    selections: await storedSelections(prepared.discharge.id),
  }
}

test.group('Planned shift addition refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses a missing value or a malformed body with the validation shape', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const before = await snapshot(prepared)

    for (const field of ['id', 'plannedStartAt', 'plannedEndAt', 'responsibleUserId']) {
      const response = await client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared, { [field]: undefined }))
        .loginAs(lead)

      response.assertStatus(422)
      assert.equal(response.body().error.code, 'E_VALIDATION_ERROR')
      assert.include(
        issuesOf(response).map(([issueField]) => issueField),
        field,
      )
    }

    assert.deepEqual(await snapshot(prepared), before)
  })

  test('refuses an inverted period and one overlapping a shift, accepting one that touches it', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const before = await snapshot(prepared)

    const inverted = await client
      .post(addUrl(prepared.discharge.id))
      .json(
        additionBody(prepared, { plannedStartAt: at(20).toISO(), plannedEndAt: at(18).toISO() }),
      )
      .loginAs(lead)
    inverted.assertStatus(422)
    assert.deepEqual(issuesOf(inverted), [['plannedEndAt', 'shiftPeriodOrder']])

    const overlapping = await client
      .post(addUrl(prepared.discharge.id))
      .json(
        additionBody(prepared, { plannedStartAt: at(10).toISO(), plannedEndAt: at(18).toISO() }),
      )
      .loginAs(lead)
    overlapping.assertStatus(422)
    assert.deepEqual(issuesOf(overlapping), [['plannedStartAt', 'shiftOverlap']])

    assert.deepEqual(await snapshot(prepared), before)

    const touching = await client
      .post(addUrl(prepared.discharge.id))
      .json(additionBody(prepared, { plannedStartAt: at(0).toISO(), plannedEndAt: at(6).toISO() }))
      .loginAs(lead)
    touching.assertStatus(201)
  })

  test('refuses a responsible who cannot be responsible for a shift', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const lead = await preparer()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    const before = await snapshot(prepared)

    for (const responsible of [observer, deactivated]) {
      const response = await client
        .post(addUrl(prepared.discharge.id))
        .json(additionBody(prepared, { responsibleUserId: responsible.id }))
        .loginAs(lead)

      response.assertStatus(422)
      assert.deepEqual(issuesOf(response), [['responsibleUserId', 'eligibleShiftResponsible']])
    }

    assert.deepEqual(await snapshot(prepared), before)
  })

  test('refuses trucks, doors, and weighing areas the shift cannot use, all at once', async ({
    assert,
    client,
  }) => {
    const prepared = await preparedWithShift()
    const { truck: unheld } = await createTruck()
    const { truck: suspended } = await createTruck('SUSPENDED')
    await reserveTruck(prepared.discharge, suspended)
    const { doorA1: unassigned, doorA2: assigned } = await createPlanningReferences()
    await assignDoorToLot(prepared, prepared.wheat.id, assigned.id)
    const archivedWarehouse = await WarehouseFactory.apply('archived').create()
    const archivedDoor = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: archivedWarehouse.id })
      .create()
    await assignDoorToLot(prepared, prepared.wheat.id, archivedDoor.id)
    const archivedArea = await WeighingAreaFactory.apply('archived').create()
    const before = await snapshot(prepared)

    const response = await client
      .post(addUrl(prepared.discharge.id))
      .json(
        additionBody(prepared, {
          plannedStartAt: at(10).toISO(),
          truckIds: [unheld.id, suspended.id],
          warehouseDoorIds: [assigned.id, unassigned.id, archivedDoor.id],
          weighingAreaIds: [archivedArea.id],
        }),
      )
      .loginAs(await preparer())

    response.assertStatus(422)
    assert.deepEqual(issuesOf(response), [
      ['plannedStartAt', 'shiftOverlap'],
      ['truckIds.0', 'heldTruck'],
      ['truckIds.1', 'selectableTruck'],
      ['warehouseDoorIds.1', 'assignedWarehouseDoor'],
      ['warehouseDoorIds.2', 'availableWarehouseDoor'],
      ['weighingAreaIds.0', 'availableWeighingArea'],
    ])
    assert.deepEqual(await snapshot(prepared), before)
  })

  test('answers an unknown discharge, a closed one, and resources on an active one', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const planned = await preparedWithShift()
    const active = await preparedWithShift('ACTIVE')
    const closed = await preparedWithShift('CLOSED')
    const { north } = await createPlanningReferences()

    const unknown = await client
      .post(addUrl('00000000-0000-4000-8000-000000000000'))
      .json(additionBody(planned))
      .loginAs(lead)
    unknown.assertStatus(404)
    assert.equal(unknown.body().error.code, 'E_DISCHARGE_NOT_FOUND')

    const closedBefore = await snapshot(closed)
    const closedResponse = await client
      .post(addUrl(closed.discharge.id))
      .json(additionBody(closed))
      .loginAs(lead)
    closedResponse.assertStatus(409)
    assert.equal(closedResponse.body().error.code, 'E_DISCHARGE_CLOSED')
    assert.deepEqual(await snapshot(closed), closedBefore)

    const activeBefore = await snapshot(active)
    const withResources = await client
      .post(addUrl(active.discharge.id))
      .json(additionBody(active, { weighingAreaIds: [north.id] }))
      .loginAs(lead)
    withResources.assertStatus(409)
    assert.equal(withResources.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
    assert.deepEqual(await snapshot(active), activeBefore)
  })

  test("refuses an identity another discharge's shift already has", async ({ assert, client }) => {
    const lead = await preparer()
    const planned = await preparedWithShift()
    const other = await preparedWithShift()
    const before = await snapshot(planned)

    const response = await client
      .post(addUrl(planned.discharge.id))
      .json(additionBody(planned, { id: other.shift.id }))
      .loginAs(lead)

    response.assertStatus(409)
    assert.equal(response.body().error.code, 'E_SHIFT_ID_CONFLICT')
    assert.deepEqual(await snapshot(planned), before)
  })

  test('refuses a preparer whose access is no longer active', async ({ assert, client }) => {
    const prepared = await preparedWithShift()
    const deactivated = await UserFactory.apply('deactivated')
      .merge({ role: 'OPERATIONS_LEAD' })
      .create()
    const before = await snapshot(prepared)

    const response = await client
      .post(addUrl(prepared.discharge.id))
      .json(additionBody(prepared))
      .loginAs(deactivated)

    assert.oneOf(response.status(), [401, 403])
    assert.deepEqual(await snapshot(prepared), before)
  })
})
