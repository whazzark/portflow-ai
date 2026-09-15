import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import type { DischargeStatus } from '#models/discharge'

/**
 * A discharge with two lots of different customers and one shift, in the status a test needs.
 * Corrections act on it; its lots and shift are what a correction must leave untouched.
 */
let scenarios = 0

export async function createPreparedDischarge(status: DischargeStatus = 'PLANNED') {
  // Customer names are unique on the site, and one test may prepare several discharges.
  scenarios += 1
  const dock = await DockFactory.create()
  const cargill = await CustomerFactory.merge({
    companyName: `Cargill France ${scenarios}`,
  }).create()
  const soufflet = await CustomerFactory.merge({
    companyName: `Soufflet Négoce ${scenarios}`,
  }).create()
  const responsible = await UserFactory.apply('active').merge({ role: 'OPERATIONS_LEAD' }).create()
  const discharge = await DischargeFactory.merge({
    dockId: dock.id,
    status,
    vesselName: 'MV Prepared',
    vesselImo: '9321483',
    vesselComment: null,
  }).create()
  const wheat = await ProductLotFactory.merge({
    dischargeId: discharge.id,
    customerId: cargill.id,
    productName: 'Blé tendre',
    expectedQuantityTonnes: new Decimal('1200.500'),
    description: null,
  }).create()
  const barley = await ProductLotFactory.merge({
    dischargeId: discharge.id,
    customerId: soufflet.id,
    productName: 'Orge',
    expectedQuantityTonnes: new Decimal('800.000'),
    description: 'Hold 2',
  }).create()
  const shift = await ShiftFactory.merge({
    dischargeId: discharge.id,
    responsibleUserId: responsible.id,
    status: status === 'PLANNED' ? 'PLANNED' : status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
  }).create()

  return { dock, cargill, soufflet, responsible, discharge, wheat, barley, shift }
}

export const PREPARING_ROLES = [
  'OPERATIONS_LEAD',
  'OPERATIONS_ADMIN',
  'ORGANIZATION_ADMIN',
] as const

export function preparer(role: (typeof PREPARING_ROLES)[number] = 'OPERATIONS_LEAD') {
  return UserFactory.apply('active').merge({ role }).create()
}

/** Gives a lot a warehouse door assignment, ended or still in effect. */
export async function assignDoor(
  prepared: Awaited<ReturnType<typeof createPreparedDischarge>>,
  lotId: string,
  { ended }: { ended: boolean },
) {
  const warehouse = await WarehouseFactory.create()
  const door = await WarehouseDoorFactory.merge({ warehouseId: warehouse.id }).create()

  return WarehouseDoorProductLotAssignmentFactory.merge({
    dischargeId: prepared.discharge.id,
    effectiveFrom: DateTime.utc(2026, 8, 1, 6),
    effectiveTo: ended ? DateTime.utc(2026, 8, 3, 18) : null,
    productLotId: lotId,
    warehouseDoorId: door.id,
  }).create()
}
