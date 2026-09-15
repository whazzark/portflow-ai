import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import {
  DischargeNotFoundException,
  DischargeNotPlannedException,
} from '#discharges/shared/discharge_exceptions'
import type DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'

/**
 * Locks a discharge and requires it to still be planned. Every correction starts here, so a start
 * confirmation that locks the same row can never interleave with one.
 */
export async function lockPlannedDischarge(
  repository: DischargePreparationRepository,
  dischargeId: string,
  client: TransactionClientContract,
) {
  const discharge = await repository.lockDischarge(dischargeId, client)

  if (!discharge) {
    throw new DischargeNotFoundException()
  }
  if (discharge.status !== 'PLANNED') {
    throw new DischargeNotPlannedException()
  }

  return discharge
}
