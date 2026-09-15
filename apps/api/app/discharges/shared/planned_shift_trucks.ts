import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import type DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import { planShiftSelection } from '#discharges/shared/truck_pool_rules'

/**
 * Decides a planned shift's new truck selection on the discharge's pool, which the caller has read
 * under the discharge's lock. Only the held trucks being added are locked: a truck that stays
 * selected needs no check, and a suspension of an added one either waits for this write or is seen
 * by it. Both the shift trucks command and the shift correction decide a selection here.
 */
export async function planShiftTruckSelection(
  repository: DischargePreparationRepository,
  selection: { dischargeId: string; shiftId: string; truckIds: string[]; now: DateTime },
  client: TransactionClientContract,
) {
  const { dischargeId, shiftId, truckIds, now } = selection
  const pool = await repository.listTruckPool(dischargeId, client)
  const heldTruckIds = new Set(
    pool.filter((row) => row.releasedAt === null).map((row) => row.truckId.toLowerCase()),
  )
  const selections = await repository.listCurrentShiftTruckSelections(dischargeId, client)
  const currentSelection = selections.filter((row) => row.shiftId === shiftId)
  const selectedIds = new Set(currentSelection.map((row) => row.truckId.toLowerCase()))
  const addedIds = truckIds.filter(
    (id) => heldTruckIds.has(id.toLowerCase()) && !selectedIds.has(id.toLowerCase()),
  )
  const addedTrucks =
    addedIds.length > 0 ? await repository.lockTrucks(addedIds, client) : new Map()

  return planShiftSelection(truckIds, heldTruckIds, currentSelection, addedTrucks, now)
}
