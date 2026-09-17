import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import type DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'

/**
 * Locks a discharge that may receive a new shift, whatever its status. Unlike
 * `lockPlannedDischarge`, it leaves the status to its caller: an addition answers a replay of
 * itself before deciding whether a started or closed discharge still admits a shift.
 */
export async function lockDischargeOpenToShifts(
  repository: DischargePreparationRepository,
  dischargeId: string,
  client: TransactionClientContract,
) {
  const discharge = await repository.lockDischarge(dischargeId, client)

  if (!discharge) {
    throw new DischargeNotFoundException()
  }

  return discharge
}
