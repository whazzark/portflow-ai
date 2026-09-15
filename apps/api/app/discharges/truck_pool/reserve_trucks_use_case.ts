import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import { throwPreparationIssues } from '#discharges/shared/discharge_preparation_issues'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import { planReservation } from '#discharges/shared/truck_pool_rules'

export type ReserveTrucksInput = {
  dischargeId: string
  truckIds: string[]
}

@inject()
export default class ReserveTrucksUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Locks the discharge, then every requested truck, before reading anything they decide: a
   * truck archived or suspended in the meantime is then either seen as such, or waits for this
   * reservation and sees it. A truck other discharges hold is reserved all the same.
   */
  async handle(input: ReserveTrucksInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const trucks = await this.preparationRepository.lockTrucks(input.truckIds, client)
      const pool = await this.preparationRepository.listTruckPool(discharge.id, client)
      const plan = planReservation(input.truckIds, pool, trucks, DateTime.utc())

      if (plan.kind === 'ISSUES') {
        throwPreparationIssues(plan.issues)
        return
      }
      if (plan.inserts.length === 0 && plan.reactivations.length === 0) {
        return
      }

      // A reservation already holding the truck could only have been written by a replay that
      // took the lock first: the outcome is the one this reservation wanted.
      await this.preparationRepository.writeTruckReservations(
        { dischargeId: discharge.id, inserts: plan.inserts, reactivations: plan.reactivations },
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
