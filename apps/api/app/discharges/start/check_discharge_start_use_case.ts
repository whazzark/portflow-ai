import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import DischargeStartRepository from '#discharges/shared/repositories/discharge_start_repository'
import {
  buildStartState,
  evaluateDischargeStart,
  startReferenceIds,
} from '#discharges/start/discharge_start_rules'

export type CheckDischargeStartInput = { dischargeId: string }

@inject()
export default class CheckDischargeStartUseCase {
  constructor(private startRepository: DischargeStartRepository) {}

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

    const plan = await this.startRepository.readStartPlan(discharge.id, client)
    const ids = startReferenceIds(discharge.dockId, plan)
    const references = await this.startRepository.readReferences(ids, 'READ', client)
    const holders = await this.startRepository.findActiveHolders(
      {
        dischargeId: discharge.id,
        dockId: discharge.dockId,
        truckIds: plan.heldTruckIds,
        warehouseDoorIds: ids.warehouseDoorIds,
      },
      client,
    )

    return {
      dischargeId: discharge.id,
      ...evaluateDischargeStart(buildStartState(discharge.id, plan, references, holders)),
    }
  }
}
