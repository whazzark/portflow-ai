import { inject } from '@adonisjs/core'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

import DischargeStartRepository, {
  type StartDischarge,
} from '#discharges/shared/repositories/discharge_start_repository'
import {
  buildStartState,
  type DischargeStartEvaluation,
  evaluateDischargeStart,
  startReferenceIds,
} from '#discharges/start/discharge_start_rules'

@inject()
export default class DischargeStartEvaluator {
  constructor(private startRepository: DischargeStartRepository) {}

  /**
   * What a start of this planned discharge would answer now, read without locks. It decides
   * nothing: the start check shows it before a confirmation, and the discharges list counts its
   * problems, so both read exactly the same evaluation. The start itself evaluates the same rules
   * again under its own locks.
   */
  async evaluate(
    discharge: StartDischarge,
    client: QueryClientContract,
  ): Promise<DischargeStartEvaluation> {
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

    return evaluateDischargeStart(buildStartState(discharge.id, plan, references, holders))
  }
}
