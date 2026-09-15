import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import { CustomerFactory } from '#database/factories/customer_factory'
import { DischargeFactory } from '#database/factories/discharge_factory'
import { DischargeTruckAssignmentFactory } from '#database/factories/discharge_truck_assignment_factory'
import { DockFactory } from '#database/factories/dock_factory'
import { ProductLotFactory } from '#database/factories/product_lot_factory'
import { ShiftFactory } from '#database/factories/shift_factory'
import { ShiftTruckFactory } from '#database/factories/shift_resource_membership_factories'
import { TransportCompanyFactory } from '#database/factories/transport_company_factory'
import { TruckFactory } from '#database/factories/truck_factory'
import { UserFactory } from '#database/factories/user_factory'
import { WarehouseDoorFactory } from '#database/factories/warehouse_door_factory'
import { WarehouseDoorProductLotAssignmentFactory } from '#database/factories/warehouse_door_product_lot_assignment_factory'
import { WarehouseFactory } from '#database/factories/warehouse_factory'
import type Discharge from '#models/discharge'
import type { DischargeStatus } from '#models/discharge'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import type Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import type Truck from '#models/truck'
import type { TruckStatus } from '#models/truck'

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

/** An available truck with its own transport company, or one in the lifecycle state a test needs. */
export async function createTruck(status: TruckStatus = 'AVAILABLE') {
  const company = await TransportCompanyFactory.create()
  scenarios += 1
  const builder = TruckFactory.merge({
    transportCompanyId: company.id,
    registration: `GH-${String(scenarios).padStart(3, '0')}-TP`,
  })
  // The lifecycle states also set the dates the truck table requires of an archive or suspension.
  const truck = await (status === 'ARCHIVED'
    ? builder.apply('archived')
    : status === 'SUSPENDED'
      ? builder.apply('suspended')
      : builder
  ).create()

  return { truck, company }
}

/**
 * Reserves a truck for a discharge the way a reservation would: the registration and company name
 * are captured from the truck as it is now. A released reservation ended a day after it began.
 */
export async function reserveTruck(
  discharge: Discharge,
  truck: Truck,
  { released = false }: { released?: boolean } = {},
) {
  await truck.load('transportCompany')
  const builder = DischargeTruckAssignmentFactory.merge({
    dischargeId: discharge.id,
    truckId: truck.id,
    registrationSnapshot: truck.registration,
    transportCompanyId: truck.transportCompanyId,
    transportCompanyNameSnapshot: truck.transportCompany.name,
    reservedAt: DateTime.utc(2026, 8, 1, 6),
  })

  return released ? builder.apply('released').create() : builder.create()
}

/**
 * Selects a truck for a shift from a fixed instant, still in effect or ended. An ended period
 * lies a day earlier, so one shift can hold both for the same truck.
 */
export function selectShiftTruck(
  shift: Shift,
  truck: Truck,
  { ended = false }: { ended?: boolean } = {},
) {
  return ShiftTruckFactory.merge({
    shiftId: shift.id,
    truckId: truck.id,
    effectiveFrom: ended ? DateTime.utc(2026, 7, 31, 6) : DateTime.utc(2026, 8, 1, 6),
    effectiveTo: ended ? DateTime.utc(2026, 7, 31, 14) : null,
  }).create()
}

/** A discharge's pool rows as stored, to assert a refused or no-op write left them untouched. */
export async function truckPoolRows(dischargeId: string) {
  const rows = await DischargeTruckAssignment.query()
    .where('dischargeId', dischargeId)
    .orderBy('id')

  return rows.map((row) => ({
    id: row.id,
    truckId: row.truckId,
    registrationSnapshot: row.registrationSnapshot,
    reservedAt: row.reservedAt.toISO(),
    releasedAt: row.releasedAt?.toISO() ?? null,
  }))
}

/** A shift's truck rows as stored, ended ones included. */
export async function shiftTruckRows(shiftId: string) {
  const rows = await ShiftTruck.query().where('shiftId', shiftId).orderBy('id')

  return rows.map((row) => ({
    id: row.id,
    truckId: row.truckId,
    effectiveFrom: row.effectiveFrom.toISO(),
    effectiveTo: row.effectiveTo?.toISO() ?? null,
  }))
}
