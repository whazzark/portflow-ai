import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  ShiftWarehouseDoorFactory,
  ShiftWeighingAreaFactory,
} from '#database/factories/shift_resource_membership_factories'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import { WeighingAreaFactory } from '#database/factories/weighing_area_factory'

import { createPreparedDischarge } from '../preparation/preparation_scenario.ts'

const EARLIER = DateTime.utc(2026, 8, 1, 6)
const LATER = DateTime.utc(2026, 8, 2, 6)

async function door() {
  const warehouse = await WarehouseFactory.create()

  return WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()
}

test.group('Current planning row indexes', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('keeps a door current on at most one lot of a discharge', async ({ assert }) => {
    const { discharge, wheat, barley } = await createPreparedDischarge()
    const { discharge: other, wheat: otherWheat } = await createPreparedDischarge()
    const shared = await door()
    const assignment = (dischargeId: string, productLotId: string, effectiveFrom = EARLIER) =>
      WarehouseDoorProductLotAssignmentFactory.merge({
        dischargeId,
        effectiveFrom,
        effectiveTo: null,
        productLotId,
        warehouseDoorId: shared.id,
      }).create()

    const current = await assignment(discharge.id, wheat.id)

    await assert.rejects(() => assignment(discharge.id, barley.id, LATER))
    await assert.doesNotReject(() => assignment(other.id, otherWheat.id))

    current.effectiveTo = LATER
    await current.save()

    await assert.doesNotReject(() => assignment(discharge.id, barley.id, LATER))
  })

  test('keeps a door or a weighing area current at most once on a shift', async ({ assert }) => {
    const { shift } = await createPreparedDischarge()
    const { shift: otherShift } = await createPreparedDischarge()
    const shiftDoor = await door()
    const area = await WeighingAreaFactory.create()
    const doorSelection = (shiftId: string, effectiveFrom = EARLIER) =>
      ShiftWarehouseDoorFactory.merge({
        effectiveFrom,
        effectiveTo: null,
        shiftId,
        warehouseDoorId: shiftDoor.id,
      }).create()
    const areaSelection = (shiftId: string, effectiveFrom = EARLIER) =>
      ShiftWeighingAreaFactory.merge({
        effectiveFrom,
        effectiveTo: null,
        shiftId,
        weighingAreaId: area.id,
      }).create()

    const currentDoor = await doorSelection(shift.id)
    const currentArea = await areaSelection(shift.id)

    await assert.rejects(() => doorSelection(shift.id, LATER))
    await assert.rejects(() => areaSelection(shift.id, LATER))
    await assert.doesNotReject(() => doorSelection(otherShift.id))
    await assert.doesNotReject(() => areaSelection(otherShift.id))

    currentDoor.effectiveTo = LATER
    await currentDoor.save()
    currentArea.effectiveTo = LATER
    await currentArea.save()

    await assert.doesNotReject(() => doorSelection(shift.id, LATER))
    await assert.doesNotReject(() => areaSelection(shift.id, LATER))
  })
})
