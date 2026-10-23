import { BaseTransformer } from '@adonisjs/core/transformers'
import { Decimal } from 'decimal.js'

import { pickListShifts, type ShiftSummary } from '#discharges/list/discharge_list_shifts'
import type { DischargeListEntry } from '#discharges/list/list_discharges_use_case'
import type Discharge from '#models/discharge'

export default class DischargeTransformer extends BaseTransformer<DischargeListEntry> {
  /**
   * The discharge as the browsing screen reads it: what identifies it, what situates it on the
   * site, and what its status's row shows — when it started and how much it expects, the shift an
   * active discharge is running, and whether a planned one is ready to start. The vessel comment,
   * the lots' quantities and descriptions, and the timestamps stay behind — they belong to the
   * detail screen, and a list that carries them invites a row to grow into one.
   */
  toObject() {
    const { discharge: resource, startProblemCount } = this.resource
    const discharge = this.pick(resource, [
      'id',
      'status',
      'vesselName',
      'vesselImo',
      'expectedStartAt',
      'startedAt',
    ])
    const expectedTonnage = resource.productLots.reduce(
      (total, productLot) => total.plus(productLot.expectedQuantityTonnes),
      new Decimal(0),
    )

    return {
      ...discharge,
      // Summed here rather than in the browser, as on the detail page: the lots are decimals, and
      // the web has no decimal arithmetic to add them without drifting.
      expectedTonnage: expectedTonnage.toFixed(3),
      dock: {
        id: resource.dock.id,
        name: resource.dock.name,
      },
      productLots: resource.productLots.map((productLot) => ({
        id: productLot.id,
        customerId: productLot.customerId,
        customerName: productLot.customer.companyName,
        productName: productLot.productName,
      })),
      // Counted rather than loaded: the count is the `n` of an active row's "Shift k / n".
      shiftCount: Number(resource.$extras.shifts_count),
      ...listShifts(resource),
      startProblemCount,
    }
  }
}

/** Only an active discharge has a shift in progress or one to come worth naming on its row. */
function listShifts(discharge: Discharge) {
  if (discharge.status !== 'ACTIVE') {
    return { activeShift: null, nextShift: null }
  }

  const { activeShift, nextShift } = pickListShifts(
    discharge.shifts.map((shift) => ({
      id: shift.id,
      sequence: shift.sequence,
      status: shift.status,
      plannedStartAt: shift.plannedStartAt,
      plannedEndAt: shift.plannedEndAt,
      responsible: {
        id: shift.responsible.id,
        firstName: shift.responsible.firstName,
        lastName: shift.responsible.lastName,
      },
    })),
  )

  return { activeShift: toShiftObject(activeShift), nextShift: toShiftObject(nextShift) }
}

/** Instants cross the boundary as ISO strings, as every other one of this response does. */
function toShiftObject(shift: ShiftSummary | null) {
  if (!shift) {
    return null
  }

  return {
    ...shift,
    plannedStartAt: shift.plannedStartAt.toISO(),
    plannedEndAt: shift.plannedEndAt.toISO(),
  }
}
