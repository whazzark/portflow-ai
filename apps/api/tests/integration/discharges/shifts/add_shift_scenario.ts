import { randomUUID } from 'node:crypto'

import { DateTime } from 'luxon'

import { ShiftFactory } from '#database/factories/shift_factory'
import Discharge from '#models/discharge'
import type { ShiftStatus } from '#models/shift'
import Shift from '#models/shift'
import ShiftTruck from '#models/shift_truck'
import ShiftWarehouseDoor from '#models/shift_warehouse_door'
import ShiftWeighingArea from '#models/shift_weighing_area'

import { createPreparedDischarge } from '../preparation/preparation_scenario.ts'

export const addUrl = (dischargeId: string) => `/api/v1/discharges/${dischargeId}/shifts`

export const at = (hour: number, day = 20) => DateTime.utc(2026, 10, day, hour)

export type Prepared = Awaited<ReturnType<typeof createPreparedDischarge>>

export type Issue = { field: string; rule: string; message: string }

export const issuesOf = (response: { body(): { error: { details: Issue[] } } }) =>
  response.body().error.details.map((issue) => [issue.field, issue.rule])

/**
 * A prepared discharge whose first shift runs from 06:00 to 14:00 on the 20th, in the status the
 * discharge's own status implies, which is where every test adds its shift around.
 */
export async function preparedWithShift(
  status: Parameters<typeof createPreparedDischarge>[0] = 'PLANNED',
) {
  const prepared = await createPreparedDischarge(status)
  await prepared.shift.merge({ plannedStartAt: at(6), plannedEndAt: at(14) }).save()

  return prepared
}

/** Another shift of the discharge, numbered and timed as a test needs. */
export function createShift(
  prepared: Prepared,
  sequence: number,
  start: DateTime,
  end: DateTime,
  status: ShiftStatus = 'PLANNED',
) {
  return ShiftFactory.merge({
    dischargeId: prepared.discharge.id,
    responsibleUserId: prepared.responsible.id,
    sequence,
    status,
    plannedStartAt: start,
    plannedEndAt: end,
  }).create()
}

export function additionBody(prepared: Prepared, overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    plannedStartAt: at(14).toISO(),
    plannedEndAt: at(22).toISO(),
    responsibleUserId: prepared.responsible.id,
    ...overrides,
  }
}

/** Every shift of a discharge as stored, in sequence order, to assert what an addition changed. */
export async function storedShifts(dischargeId: string) {
  const shifts = await Shift.query().where('dischargeId', dischargeId).orderBy('sequence')

  return shifts.map((shift) => ({
    id: shift.id,
    sequence: shift.sequence,
    status: shift.status,
    plannedStartAt: shift.plannedStartAt.toUTC().toISO(),
    plannedEndAt: shift.plannedEndAt.toUTC().toISO(),
    responsibleUserId: shift.responsibleUserId,
  }))
}

/** Every resource selection of a discharge's shifts, to assert a refusal wrote none. */
export async function storedSelections(dischargeId: string) {
  const shiftIds = (await Shift.query().where('dischargeId', dischargeId).select('id')).map(
    (shift) => shift.id,
  )
  const [trucks, doors, areas] = await Promise.all([
    ShiftTruck.query().whereIn('shiftId', shiftIds).orderBy('id'),
    ShiftWarehouseDoor.query().whereIn('shiftId', shiftIds).orderBy('id'),
    ShiftWeighingArea.query().whereIn('shiftId', shiftIds).orderBy('id'),
  ])

  return {
    trucks: trucks.map((row) => [row.shiftId, row.truckId]),
    doors: doors.map((row) => [row.shiftId, row.warehouseDoorId]),
    areas: areas.map((row) => [row.shiftId, row.weighingAreaId]),
  }
}

export async function dischargeStatus(dischargeId: string) {
  return (await Discharge.findOrFail(dischargeId)).status
}
