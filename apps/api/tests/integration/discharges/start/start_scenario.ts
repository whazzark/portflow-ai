import { DateTime } from 'luxon'

import {
  ShiftWarehouseDoorFactory,
  ShiftWeighingAreaFactory,
} from '#database/factories/shift_resource_membership_factories'
import Discharge from '#models/discharge'
import DischargeTruckAssignment from '#models/discharge_truck_assignment'
import Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'
import WarehouseDoorProductLotAssignment from '#models/warehouse_door_product_lot_assignment'

import {
  addPlannedShift,
  assignDoorToLot,
  createPlanningReferences,
  createPreparedDischarge,
  createTruck,
  reserveTruck,
  selectShiftTruck,
} from '../preparation/preparation_scenario.ts'

/**
 * A planned discharge that can start: each lot has a door of its own, the pool holds one truck,
 * and its first shift uses that truck, a door, and a weighing area. A later planned shift has no
 * resource, since only the first shift's are required.
 */
export async function createStartableDischarge() {
  const prepared = await createPreparedDischarge()
  const references = await createPlanningReferences()
  const { truck } = await createTruck()
  await assignDoorToLot(prepared, prepared.wheat.id, references.doorA1.id)
  await assignDoorToLot(prepared, prepared.barley.id, references.doorB1.id)
  await reserveTruck(prepared.discharge, truck)
  await selectShiftTruck(prepared.shift, truck)
  await ShiftWarehouseDoorFactory.merge({
    shiftId: prepared.shift.id,
    warehouseDoorId: references.doorA1.id,
    effectiveFrom: DateTime.utc(2026, 8, 1, 6),
  }).create()
  await ShiftWeighingAreaFactory.merge({
    shiftId: prepared.shift.id,
    weighingAreaId: references.north.id,
    effectiveFrom: DateTime.utc(2026, 8, 1, 6),
  }).create()
  const laterShift = await addPlannedShift(prepared)

  return { ...prepared, references, truck, laterShift }
}

/**
 * Every row a start must leave as it is: the plan's pool, door assignments, and shift selections,
 * and every shift's period and responsible.
 */
export async function planRows(dischargeId: string) {
  const shifts = await Shift.query().where('dischargeId', dischargeId).orderBy('id')
  const shiftIds = shifts.map((shift) => shift.id)
  const rows = <Row extends { id: string; effectiveTo?: DateTime | null }>(list: Row[]) =>
    list.map((row) => ({ id: row.id, effectiveTo: row.effectiveTo?.toISO() ?? null }))

  return {
    shifts: shifts.map((shift) => ({
      id: shift.id,
      plannedStartAt: shift.plannedStartAt.toISO(),
      plannedEndAt: shift.plannedEndAt.toISO(),
      responsibleUserId: shift.responsibleUserId,
    })),
    pool: (
      await DischargeTruckAssignment.query().where('dischargeId', dischargeId).orderBy('id')
    ).map((row) => ({ id: row.id, releasedAt: row.releasedAt?.toISO() ?? null })),
    doorAssignments: rows(
      await WarehouseDoorProductLotAssignment.query()
        .where('dischargeId', dischargeId)
        .orderBy('id'),
    ),
    shiftTrucks: rows(await ShiftTruck.query().whereIn('shiftId', shiftIds).orderBy('id')),
    shiftDoors: rows(await ShiftWarehouseDoor.query().whereIn('shiftId', shiftIds).orderBy('id')),
    shiftAreas: rows(await ShiftWeighingArea.query().whereIn('shiftId', shiftIds).orderBy('id')),
  }
}

/** The start state of a discharge and its shifts as stored. */
export async function startRows(dischargeId: string) {
  const discharge = await Discharge.findOrFail(dischargeId)
  const shifts = await Shift.query().where('dischargeId', dischargeId).orderBy('sequence')

  return {
    status: discharge.status,
    startedAt: discharge.startedAt?.toISO() ?? null,
    startedByUserId: discharge.startedByUserId,
    shifts: shifts.map((shift) => ({
      id: shift.id,
      status: shift.status,
      actualStartAt: shift.actualStartAt?.toISO() ?? null,
      startedByUserId: shift.startedByUserId,
    })),
  }
}
