import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { DischargeFactory } from '#database/factories/discharge_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'

import {
  createPreparedDischarge,
  PREPARING_ROLES,
  preparer,
} from '../preparation/preparation_scenario.ts'

type PlanningDoor = {
  id: string
  name: string
  warehouse: { id: string; name: string }
  otherDischargeAssignments: Array<{
    discharge: { id: string; vesselName: string; status: string; expectedStartAt: string }
  }>
}

test.group('Discharge planning options HTTP contract', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('rejects unauthenticated, non-active, and observer requests', async ({ client }) => {
    const { discharge } = await createPreparedDischarge()
    const pending = await UserFactory.merge({ role: 'OPERATIONS_LEAD' }).create()
    const observer = await UserFactory.apply('active').merge({ role: 'OBSERVER' }).create()
    const url = `/api/v1/discharges/${discharge.id}/planning-options`

    ;(await client.get(url)).assertStatus(401)
    ;(await client.get(url).loginAs(pending)).assertStatus(401)
    ;(await client.get(url).loginAs(observer)).assertStatus(403)
  })

  test('answers every preparing role', async ({ client }) => {
    const { discharge } = await createPreparedDischarge()

    for (const role of PREPARING_ROLES) {
      const response = await client
        .get(`/api/v1/discharges/${discharge.id}/planning-options`)
        .loginAs(await preparer(role))

      response.assertStatus(200)
    }
  })

  test('answers not found for an unknown or malformed discharge', async ({ assert, client }) => {
    const lead = await preparer()

    for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
      const response = await client.get(`/api/v1/discharges/${id}/planning-options`).loginAs(lead)

      response.assertStatus(404)
      assert.equal(response.body().error.code, 'E_DISCHARGE_NOT_FOUND')
    }
  })

  test('lists available doors of available warehouses and available weighing areas, in name order', async ({
    assert,
    client,
  }) => {
    const { discharge } = await createPreparedDischarge()
    const zulu = await WarehouseFactory.merge({ name: 'zulu Magasin' }).create()
    const alpha = await WarehouseFactory.merge({ name: 'Alpha Magasin' }).create()
    const closedWarehouse = await WarehouseFactory.apply('archived')
      .merge({ name: 'Beta Magasin' })
      .create()
    const alphaB = await WarehouseDoorFactory.merge({
      name: 'porte B',
      warehouseId: alpha.id,
    }).create()
    const alphaA = await WarehouseDoorFactory.merge({
      name: 'Porte A',
      warehouseId: alpha.id,
    }).create()
    const zuluA = await WarehouseDoorFactory.merge({
      name: 'Porte A',
      warehouseId: zulu.id,
    }).create()
    const retired = await WarehouseDoorFactory.apply('archived')
      .merge({ name: 'Porte Retirée', warehouseId: alpha.id })
      .create()
    const doorOfClosedWarehouse = await WarehouseDoorFactory.apply('archived')
      .merge({ name: 'Porte C', warehouseId: closedWarehouse.id })
      .create()
    const pont = await WeighingAreaFactory.merge({ name: 'pont Nord' }).create()
    const bascule = await WeighingAreaFactory.merge({ name: 'Bascule Sud' }).create()
    const ancien = await WeighingAreaFactory.apply('archived')
      .merge({ name: 'Ancien Pont' })
      .create()
    // Other suites may leave site references behind, so only this test's rows are compared.
    const doorIds = new Set([alphaA.id, alphaB.id, zuluA.id, retired.id, doorOfClosedWarehouse.id])
    const areaIds = new Set([pont.id, bascule.id, ancien.id])

    const response = await client
      .get(`/api/v1/discharges/${discharge.id}/planning-options`)
      .loginAs(await preparer())

    response.assertStatus(200)
    const doors = (response.body().data.warehouseDoors as PlanningDoor[]).filter((door) =>
      doorIds.has(door.id),
    )
    const areas = (response.body().data.weighingAreas as Array<{ id: string }>).filter((area) =>
      areaIds.has(area.id),
    )
    assert.deepEqual(
      doors.map((door) => [door.id, door.name, door.warehouse]),
      [
        [alphaA.id, 'Porte A', { id: alpha.id, name: 'Alpha Magasin' }],
        [alphaB.id, 'porte B', { id: alpha.id, name: 'Alpha Magasin' }],
        [zuluA.id, 'Porte A', { id: zulu.id, name: 'zulu Magasin' }],
      ],
    )
    assert.deepEqual(areas, [
      { id: bascule.id, name: 'Bascule Sud' },
      { id: pont.id, name: 'pont Nord' },
    ])
  })

  test('names the other planned and active discharges holding a door, and only those', async ({
    assert,
    client,
  }) => {
    const { discharge, wheat } = await createPreparedDischarge()
    const warehouse = await WarehouseFactory.create()
    const door = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()
    const later = await DischargeFactory.merge({
      dockId: discharge.dockId,
      expectedStartAt: DateTime.utc(2026, 11, 2, 6),
      status: 'PLANNED',
      vesselName: 'MV Later',
    }).create()
    const earlier = await DischargeFactory.apply('active')
      .merge({
        dockId: discharge.dockId,
        expectedStartAt: DateTime.utc(2026, 9, 2, 6),
        vesselName: 'MV Earlier',
      })
      .create()
    const closed = await DischargeFactory.apply('closed')
      .merge({ dockId: discharge.dockId, vesselName: 'MV Closed' })
      .create()
    const ended = await DischargeFactory.merge({
      dockId: discharge.dockId,
      status: 'PLANNED',
      vesselName: 'MV Ended',
    }).create()
    const assign = async (
      target: { id: string },
      options: { productLotId?: string; effectiveTo?: DateTime | null } = {},
    ) => {
      const lotId =
        options.productLotId ??
        (
          await ProductLotFactory.merge({
            customerId: wheat.customerId,
            dischargeId: target.id,
          }).create()
        ).id

      await WarehouseDoorProductLotAssignmentFactory.merge({
        dischargeId: target.id,
        effectiveFrom: DateTime.utc(2026, 8, 1, 6),
        effectiveTo: options.effectiveTo ?? null,
        productLotId: lotId,
        warehouseDoorId: door.id,
      }).create()
    }

    await assign(discharge, { productLotId: wheat.id })
    await assign(later)
    await assign(earlier)
    await assign(closed)
    await assign(ended, { effectiveTo: DateTime.utc(2026, 8, 2, 6) })

    const response = await client
      .get(`/api/v1/discharges/${discharge.id}/planning-options`)
      .loginAs(await preparer())

    response.assertStatus(200)
    const listed = (response.body().data.warehouseDoors as PlanningDoor[]).find(
      (candidate) => candidate.id === door.id,
    )
    assert.deepEqual(
      listed?.otherDischargeAssignments.map(({ discharge: other }) => [
        other.id,
        other.vesselName,
        other.status,
      ]),
      [
        [earlier.id, 'MV Earlier', 'ACTIVE'],
        [later.id, 'MV Later', 'PLANNED'],
      ],
    )
    assert.isString(listed?.otherDischargeAssignments[0].discharge.expectedStartAt)
  })
})
