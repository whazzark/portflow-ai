import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

import { UserFactory } from '#database/factories/user_factory'

import {
  createPlanningReferences,
  createPreparedDischarge,
  preparer,
} from '../preparation/preparation_scenario.ts'

type Blocker = { id: string; reason: string }

test.group('Archive guards against planned doors and checkpoints', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('refuses to archive a door, its warehouse, or a weighing area a planned discharge uses', async ({
    assert,
    client,
  }) => {
    const prepared = await createPreparedDischarge()
    const { doorA1, north, magasinA } = await createPlanningReferences()
    const lead = await preparer()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const lotDoors = `/api/v1/discharges/${prepared.discharge.id}/product-lots/${prepared.wheat.id}/warehouse-doors`
    const shift = `/api/v1/discharges/${prepared.discharge.id}/shifts/${prepared.shift.id}`

    await client
      .patch(lotDoors)
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)
    // The shift keeps its period and responsible; only its weighing area is added, since it is the
    // selection the archive must then refuse.
    await client
      .put(shift)
      .json({
        plannedStartAt: prepared.shift.plannedStartAt.toISO(),
        plannedEndAt: prepared.shift.plannedEndAt.toISO(),
        responsibleUserId: prepared.responsible.id,
        truckIds: [],
        warehouseDoorIds: [],
        weighingAreaIds: [north.id],
      })
      .loginAs(lead)

    const door = await client
      .post(`/api/v1/warehouse-doors/${doorA1.id}/archive`)
      .json({})
      .loginAs(admin)
    door.assertStatus(409)
    assert.equal(door.body().error.code, 'E_WAREHOUSE_DOOR_IN_USE')

    const doors = await client
      .post('/api/v1/warehouse-doors/archive')
      .json({ ids: [doorA1.id] })
      .loginAs(admin)
    assert.deepEqual(
      (doors.body().data.blockedDoors as Blocker[]).map((blocker) => [blocker.id, blocker.reason]),
      [[doorA1.id, 'IN_USE']],
    )

    const warehouse = await client
      .post(`/api/v1/warehouses/${magasinA.id}/archive`)
      .json({})
      .loginAs(admin)
    warehouse.assertStatus(409)
    assert.equal(warehouse.body().error.code, 'E_WAREHOUSE_IN_USE')

    const area = await client
      .post(`/api/v1/weighing-areas/${north.id}/archive`)
      .json({})
      .loginAs(admin)
    area.assertStatus(409)
    assert.equal(area.body().error.code, 'E_WEIGHING_AREA_IN_USE')

    const areas = await client
      .post('/api/v1/weighing-areas/archive')
      .json({ ids: [north.id] })
      .loginAs(admin)
    assert.deepEqual(
      (areas.body().data.blockedWeighingAreas as Blocker[]).map((blocker) => [
        blocker.id,
        blocker.reason,
      ]),
      [[north.id, 'IN_USE']],
    )
  })

  test('lets them be archived once the discharge no longer uses them', async ({ client }) => {
    const prepared = await createPreparedDischarge()
    const { doorA1, north } = await createPlanningReferences()
    const lead = await preparer()
    const admin = await UserFactory.apply('active').merge({ role: 'OPERATIONS_ADMIN' }).create()
    const lotDoors = `/api/v1/discharges/${prepared.discharge.id}/product-lots/${prepared.wheat.id}/warehouse-doors`
    const checkpoints = `/api/v1/discharges/${prepared.discharge.id}/shifts/${prepared.shift.id}/checkpoints`
    const areas = (add: string[], remove: string[]) => ({
      warehouseDoors: { add: [], remove: [] },
      weighingAreas: { add, remove },
    })

    await client
      .patch(lotDoors)
      .json({ assign: [doorA1.id], withdraw: [] })
      .loginAs(lead)
    await client
      .patch(checkpoints)
      .json(areas([north.id], []))
      .loginAs(lead)
    await client
      .patch(lotDoors)
      .json({ assign: [], withdraw: [doorA1.id] })
      .loginAs(lead)
    await client
      .patch(checkpoints)
      .json(areas([], [north.id]))
      .loginAs(lead)

    ;(
      await client.post(`/api/v1/warehouse-doors/${doorA1.id}/archive`).json({}).loginAs(admin)
    ).assertStatus(200)
    ;(
      await client.post(`/api/v1/weighing-areas/${north.id}/archive`).json({}).loginAs(admin)
    ).assertStatus(200)
  })
})
