import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargeStartRepository from '#discharges/shared/repositories/discharge_start_repository'
import DischargeStartEvaluator from '#discharges/start/discharge_start_evaluator'

export type CheckDischargeStartInput = { dischargeId: string }

@inject()
export default class CheckDischargeStartUseCase {
  constructor(
    private startRepository: DischargeStartRepository,
    private startEvaluator: DischargeStartEvaluator,
  ) {}

  /**
   * What a start would answer now, for the review a user reads before confirming. It takes no lock:
   * it decides nothing, and the start evaluates the same rules again under its own locks, since the
   * plan and the other discharges may change between the two.
   */
  async handle(input: CheckDischargeStartInput) {
    const client = db.connection()
    const discharge = await this.startRepository.findDischarge(input.dischargeId, client)

    if (!discharge) {
      throw new DischargeNotFoundException()
    }
    if (discharge.status !== 'PLANNED') {
      throw new DischargeNotPlannedException()
    }

    return {
      dischargeId: discharge.id,
      ...(await this.startEvaluator.evaluate(discharge, client)),
    }
  }
}
