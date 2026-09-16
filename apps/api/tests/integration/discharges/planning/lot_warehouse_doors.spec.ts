import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

import {
  createPlanningReferences,
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from '../preparation/preparation_scenario.ts'

type DoorPeriod = {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  warehouseDoor: { id: string }
  warehouse: { id: string }
}
type DetailLot = { id: string; doorAssignments: DoorPeriod[] }

const url = (dischargeId: string, lotId: string) =>
  `/api/v1/discharges/${dischargeId}/product-lots/${lotId}/warehouse-doors`

function lotOf(body: { data: { productLots: DetailLot[] } }, lotId: string) {
  const lot = body.data.productLots.find((candidate) => candidate.id === lotId)
  if (!lot) {
    throw new Error(`lot ${lotId} missing from the detail`)
  }

  return lot
}

const currentDoors = (lot: DetailLot) =>
  lot.doorAssignments
    .filter((period) => period.effectiveTo === null)
    .map((period) => period.warehouseDoor.id)
    .sort()

function assignmentRows() {
  return WarehouseDoorProductLotAssignment.query().orderBy('id')
}

test.group('Lot warehouse doors HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ assert, client }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const body = { assign: [doorA1.id], withdraw: [] }

    ;(await client.patch(url(discharge.id, wheat.id)).json(body)).assertStatus(401)
    ;(await client.patch(url(discharge.id, wheat.id)).json(body).loginAs(pending)).assertStatus(401)
    ;(await client.patch(url(discharge.id, wheat.id)).json(body).loginAs(observer)).assertStatus(
      403,
    )

    assert.lengthOf(await assignmentRows(), 0)
  })

  test('assigns doors of several warehouses for every preparing role, from one instant', async ({
    assert,
    client,
  }) => {
    for (const role of PREPARING_ROLES) {
      const { discharge, wheat } = await createPreparedDischarge()
      const { doorA1, doorB1 } = await createPlanningReferences()

      const response = await client
        .patch(url(discharge.id, wheat.id))
        .json({ assign: [doorA1.id, doorB1.id], withdraw: [] })
        .loginAs(await preparer(role))

      response.assertStatus(200)
      const lot = lotOf(response.body(), wheat.id)
      assert.deepEqual(currentDoors(lot), [doorA1.id, doorB1.id].sort())
      assert.equal(lot.doorAssignments[0].effectiveFrom, lot.doorAssignments[1].effectiveFrom)
    }
  })

  test('withdraws a door and keeps its ended assignment', async ({ assert, client }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1, doorA2 } = await createPlanningReferences()
    const lead = await preparer()
    await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [doorA1.id, doorA2.id], withdraw: [] })
      .loginAs(lead)

    const response = await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [], withdraw: [doorA1.id] })
      .loginAs(lead)

    response.assertStatus(200)
    const lot = lotOf(response.body(), wheat.id)
    assert.deepEqual(currentDoors(lot), [doorA2.id])
    const ended = lot.doorAssignments.find((period) => period.warehouseDoor.id === doorA1.id)
    assert.isString(ended?.effectiveTo)
    assert.isAbove(Date.parse(ended?.effectiveTo ?? ''), Date.parse(ended?.effectiveFrom ?? ''))
    assert.lengthOf(await assignmentRows(), 2)
  })

  test('moves a door from another lot of the discharge at one instant', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat, barley } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)

    const response = await client
      .patch(url(discharge.id, barley.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)

    response.assertStatus(200)
    const taken = lotOf(response.body(), wheat.id).doorAssignments[0]
    const received = lotOf(response.body(), barley.id).doorAssignments[0]
    assert.isNotNull(taken.effectiveTo)
    assert.isNull(received.effectiveTo)
    assert.equal(taken.effectiveTo, received.effectiveFrom)
    assert.lengthOf(
      (await assignmentRows()).filter((row) => row.effectiveTo === null),
      1,
    )
  })

  test('starts a new assignment when a withdrawn door is assigned again', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    const change = (assign: string[], withdraw: string[]) =>
      client.patch(url(discharge.id, wheat.id)).json({ assign, withdraw }).loginAs(lead)

    await change([doorA1.id], [])
    await change([], [doorA1.id])
    const response = await change([doorA1.id], [])

    response.assertStatus(200)
    const periods = lotOf(response.body(), wheat.id).doorAssignments
    assert.lengthOf(periods, 2)
    assert.deepEqual(currentDoors(lotOf(response.body(), wheat.id)), [doorA1.id])
  })

  test('records nothing twice, and nothing for an empty change set', async ({ assert, client }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1, doorB1 } = await createPlanningReferences()
    const lead = await preparer()
    const body = { assign: [doorA1.id, doorB1.id], withdraw: [] }

    await client.patch(url(discharge.id, wheat.id)).json(body).loginAs(lead)
    const replay = await client.patch(url(discharge.id, wheat.id)).json(body).loginAs(lead)
    const empty = await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [], withdraw: [] })
      .loginAs(lead)

    replay.assertStatus(200)
    empty.assertStatus(200)
    assert.lengthOf(await assignmentRows(), 2)
  })

  test('leaves another lot untouched when withdrawing a door this lot does not hold', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat, barley } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    await client
      .patch(url(discharge.id, barley.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)

    const response = await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [], withdraw: [doorA1.id] })
      .loginAs(lead)

    response.assertStatus(200)
    assert.deepEqual(currentDoors(lotOf(response.body(), barley.id)), [doorA1.id])
  })

  test('assigns a door another planned or active discharge holds, without changing it', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const planned = await createPreparedDischarge()
    const active = await createPreparedDischarge('ACTIVE')
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    await client
      .patch(url(planned.discharge.id, planned.wheat.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)
    await WarehouseDoorProductLotAssignment.create({
      dischargeId: active.discharge.id,
      productLotId: active.wheat.id,
      warehouseDoorId: doorA1.id,
      effectiveFrom: (await WarehouseDoorProductLotAssignment.firstOrFail()).effectiveFrom,
      effectiveTo: null,
    })

    const response = await client
      .patch(url(discharge.id, wheat.id))
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)

    response.assertStatus(200)
    assert.deepEqual(currentDoors(lotOf(response.body(), wheat.id)), [doorA1.id])
    assert.lengthOf(
      (await assignmentRows()).filter((row) => row.effectiveTo === null),
      3,
    )
  })

  test('rejects a malformed change set without recording anything', async ({ assert, client }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const { doorA1 } = await createPlanningReferences()
    const lead = await preparer()
    const many = Array.from(
      { length: 201 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    )

    for (const [body, field, rule] of [
      [{ assign: [doorA1.id, doorA1.id], withdraw: [] }, 'assign', 'distinct'],
      // biome-ignore lint/security/noSecrets: rule name, not a secret
      [{ assign: [doorA1.id], withdraw: [doorA1.id] }, 'withdraw.0', 'notInBothLists'],
      [{ assign: ['not-a-uuid'], withdraw: [] }, 'assign.0', 'uuid'],
      [{ assign: many, withdraw: [] }, 'assign', 'array.maxLength'],
      [{ assign: [doorA1.id] }, 'withdraw', 'required'],
    ] as const) {
      const response = await client.patch(url(discharge.id, wheat.id)).json(body).loginAs(lead)

      response.assertStatus(422)
      assert.deepInclude(
        response
          .body()
          .error.details.map((issue: { field: string; rule: string }) => [issue.field, issue.rule]),
        [field, rule],
      )
    }

    assert.lengthOf(await assignmentRows(), 0)
  })
})
