import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import DischargeStartEvaluator from '#discharges/start/discharge_start_evaluator'
import type Discharge from '#models/discharge'

/** A listed discharge, with what its status's row needs beyond the discharge itself. */
export type DischargeListEntry = {
  discharge: Discharge
  /** How many problems a start would report now; `null` unless the discharge is planned. */
  startProblemCount: number | null
}

@inject()
export default class ListDischargesUseCase {
  constructor(
    private dischargeRepository: DischargeRepository,
    private startEvaluator: DischargeStartEvaluator,
  ) {}

  /**
   * Every discharge, each planned one with the number of problems its start check reports. The
   * count comes from the very evaluation the start dialog shows, so a row never says Ready while
   * the dialog lists a problem. It reads without locks, like the start check: it decides nothing.
   * Planned discharges are evaluated one after the other on one connection; they are a small part
   * of the site's history.
   */
  async handle(): Promise<DischargeListEntry[]> {
    const discharges = await this.dischargeRepository.list()
    const client = db.connection()
    const entries: DischargeListEntry[] = []

    for (const discharge of discharges) {
      const evaluation =
        discharge.status === 'PLANNED'
          ? await this.startEvaluator.evaluate(discharge, client)
          : null

      entries.push({ discharge, startProblemCount: evaluation?.problems.length ?? null })
    }

    return entries
  }
}
