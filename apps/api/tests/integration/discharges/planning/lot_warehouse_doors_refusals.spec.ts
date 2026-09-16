import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { ShiftWarehouseDoorFactory } from '#database/factories/shift_resource_membership_factories'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

import {
  assignDoorToLot,
  createPlanningReferences,
  createPreparedDischarge,
  preparer,
} from '../preparation/preparation_scenario.ts'

const url = (dischargeId: string, lotId: string) =>
  `/api/v1/discharges/${dischargeId}/product-lots/${lotId}/warehouse-doors`

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'

async function assignmentSnapshot() {
  return (await WarehouseDoorProductLotAssignment.query().orderBy('id')).map((row) => [
    row.id,
    row.productLotId,
    row.warehouseDoorId,
    row.effectiveTo?.toISO() ?? null,
  ])
}

function issues(body: { error: { details: Array<{ field: string; rule: string }> } }) {
  return body.error.details.map((issue) => [issue.field, issue.rule])
}

test.group('Lot warehouse doors refusals', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses every door no longer available at once, and assigns none of the others', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const archivedDoor = await WarehouseDoorFactory.apply('archived')
      .merge({ warehouseId: doorA1.warehouseId })
      .create()
    const closedWarehouse = await WarehouseFactory.apply('archived').create()
    const doorOfClosedWarehouse = await WarehouseDoorFactory.merge({
      warehouseId: closedWarehouse.id,
    }).create()

    const response = await client
      .patch(url(discharge.id, wheat.id))
      .json({
        assign: [doorA1.id, archivedDoor.id, doorOfClosedWarehouse.id, UNKNOWN_ID],
        withdraw: [],
      })
      .loginAs(await preparer())

    response.assertStatus(422)
    assert.deepEqual(issues(response.body()), [
      ['assign.1', 'availableWarehouseDoor'],
      ['assign.2', 'availableWarehouseDoor'],
      ['assign.3', 'availableWarehouseDoor'],
    ])
    assert.deepEqual(await assignmentSnapshot(), [])
  })

  test('refuses to withdraw a door a planned shift still selects, until the shift lets it go', async ({
    assert,
    client,
  }) => {
    const prepared = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    await assignDoorToLot(prepared, prepared.wheat.id, doorA1.id)
    const selection = await ShiftWarehouseDoorFactory.merge({
      shiftId: prepared.shift.id,
      warehouseDoorId: doorA1.id,
    }).create()
    const lead = await preparer()
    const before = await assignmentSnapshot()

    const refused = await client
      .patch(url(prepared.discharge.id, prepared.wheat.id))
      .json({ assign: [], withdraw: [doorA1.id] })
      .loginAs(lead)

    refused.assertStatus(422)
    assert.deepEqual(issues(refused.body()), [['withdraw.0', 'selectedByPlannedShift']])
    assert.deepEqual(await assignmentSnapshot(), before)

    // The shift lets the door go through its own correction, which drops the row outright: a shift
    // that has not started has no period to end.
    await client
      .put(`/api/v1/discharges/${prepared.discharge.id}/shifts/${prepared.shift.id}`)
      .json({
        plannedStartAt: prepared.shift.plannedStartAt.toISO(),
        plannedEndAt: prepared.shift.plannedEndAt.toISO(),
        responsibleUserId: prepared.responsible.id,
        truckIds: [],
        warehouseDoorIds: [],
        weighingAreaIds: [],
      })
      .loginAs(lead)
    assert.isNull(await ShiftWarehouseDoor.find(selection.id))

    const accepted = await client
      .patch(url(prepared.discharge.id, prepared.wheat.id))
      .json({ assign: [], withdraw: [doorA1.id] })
      .loginAs(lead)

    accepted.assertStatus(200)
  })

  test('moves a door a planned shift selects to another lot, leaving the shift untouched', async ({
    assert,
    client,
  }) => {
    const prepared = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    await assignDoorToLot(prepared, prepared.wheat.id, doorA1.id)
    await ShiftWarehouseDoorFactory.merge({
      shiftId: prepared.shift.id,
      warehouseDoorId: doorA1.id,
    }).create()

    const response = await client
      .patch(url(prepared.discharge.id, prepared.barley.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(await preparer())

    response.assertStatus(200)
    const selections = await ShiftWarehouseDoor.all()
    assert.lengthOf(selections, 1)
    assert.isNull(selections[0].effectiveTo)
  })

  test('refuses any change on an active or closed discharge, even for an unknown lot', async ({
    assert,
    client,
  }) => {
    const lead = await preparer()
    const { doorA1 } = await createPlanningReferences()

    for (const status of ['ACTIVE', 'CLOSED'] as const) {
      const { discharge, wheat } = await createPreparedDischarge(status)

      for (const lotId of [wheat.id, UNKNOWN_ID]) {
        const response = await client
          .patch(url(discharge.id, lotId))
          .json({ assign: [doorA1.id], withdraw: [] })
          .loginAs(lead)

        response.assertStatus(409)
        assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_PLANNED')
      }
    }

    assert.deepEqual(await assignmentSnapshot(), [])
  })

  test('answers not found for an unknown discharge or lot, or a lot of another discharge', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const other = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    const body = { assign: [doorA1.id], withdraw: [] }

    for (const [dischargeId, lotId, code] of [
      [discharge.id, UNKNOWN_ID, 'E_PRODUCT_LOT_NOT_FOUND'],
      [discharge.id, 'not-a-uuid', 'E_PRODUCT_LOT_NOT_FOUND'],
      [discharge.id, other.wheat.id, 'E_PRODUCT_LOT_NOT_FOUND'],
      ['not-a-uuid', other.wheat.id, 'E_DISCHARGE_NOT_FOUND'],
    ] as const) {
      const response = await client.patch(url(dischargeId, lotId)).json(body).loginAs(lead)

      response.assertStatus(404)
      assert.equal(response.body().error.code, code)
    }

    assert.deepEqual(await assignmentSnapshot(), [])
  })
})
