import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import {
  DischargeNotFoundException,
  ShiftNotFoundException,
  ShiftNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import { throwPreparationIssues } from '#discharges/shared/discharge_preparation_issues'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import { planShiftTruckSelection } from '#discharges/shared/planned_shift_trucks'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type SelectShiftTrucksInput = {
  dischargeId: string
  shiftId: string
  truckIds: string[]
}

@inject()
export default class SelectShiftTrucksUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * The pool and the shift are read under the discharge's lock, which every writer of them takes
   * first; `planShiftTruckSelection` then locks only the trucks being added.
   */
  async handle(input: SelectShiftTrucksInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const shift = await this.preparationRepository.findShift(discharge.id, input.shiftId, client)

      if (!shift) {
        throw new ShiftNotFoundException()
      }
      if (shift.status !== 'PLANNED') {
        throw new ShiftNotPlannedException()
      }

      const plan = await planShiftTruckSelection(
        this.preparationRepository,
        {
          dischargeId: discharge.id,
          shiftId: shift.id,
          truckIds: input.truckIds,
          now: DateTime.utc(),
        },
        client,
      )

      if (plan.kind === 'ISSUES') {
        throwPreparationIssues(plan.issues)
        return
      }
      if (plan.deleteIds.length === 0 && plan.inserts.length === 0) {
        return
      }

      // A selection already written for the same instant can only be a replay that took the lock
      // first: the outcome is the one this selection wanted.
      await this.preparationRepository.writeShiftTruckSelection(
        {
          dischargeId: discharge.id,
          shiftId: shift.id,
          deleteIds: plan.deleteIds,
          inserts: plan.inserts,
        },
        client,
      )
    })

    const read = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!read) {
      throw new DischargeNotFoundException()
    }

    return read
  }
}
