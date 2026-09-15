import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { Decimal } from 'decimal.js'
import type { DateTime } from 'luxon'

import {
  type PreparationIssue,
  throwPreparationIssues,
  unavailableCustomerIssue,
  unavailableDockIssue,
} from '#discharges/shared/discharge_preparation_issues'
import {
  duplicateLotIssue,
  findPreparationIssues,
  orderShifts,
} from '#discharges/shared/discharge_preparation_rules'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'
import { isEligibleShiftResponsible } from '#users/shared/shift_responsible_eligibility'

export type CreatePlannedDischargeInput = {
  id: string
  vesselName: string
  vesselImo: string | null
  vesselComment: string | null
  dockId: string
  expectedStartAt: DateTime
  productLots: Array<{
    customerId: string
    productName: string
    expectedQuantityTonnes: string
    description: string | null
  }>
  shifts: Array<{
    plannedStartAt: DateTime
    plannedEndAt: DateTime
    responsibleUserId: string
  }>
}

const optionalText = (value: string | null) => value?.trim() || null

@inject()
export default class CreatePlannedDischargeUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Creates the discharge with its lots and first shifts, all planned, in one transaction.
   *
   * The identity comes from the creation page, generated before its first attempt. A submission
   * that finds a discharge already holding it — a retry after a lost response, a second click that
   * raced the first — is that same creation, so it returns the existing discharge instead of
   * creating another (`created: false`). Its payload is not compared: the identity only lives as
   * long as one creation page.
   *
   * Every refusal of an entered value is reported with its position in the submission: the rules
   * across lots and shifts before any lock, then the dock, customers, and responsibles found
   * unavailable or ineligible under the locks the write holds.
   */
  async handle(input: CreatePlannedDischargeInput) {
    throwPreparationIssues(findPreparationIssues(input))

    const id = input.id.toLowerCase()
    const productLots = input.productLots.map((productLot) => ({
      customerId: productLot.customerId,
      productName: productLot.productName.trim(),
      expectedQuantityTonnes: new Decimal(productLot.expectedQuantityTonnes),
      description: optionalText(productLot.description),
    }))
    const shifts = orderShifts(input.shifts)

    const created = await db.transaction(async (client) => {
      if (await this.preparationRepository.findDischargeIdentity(id, client)) {
        return false
      }

      await this.checkReferencesUnderLock(input, client)

      const result = await this.preparationRepository.createPlannedDischarge(
        {
          id,
          vesselName: input.vesselName.trim(),
          vesselImo: optionalText(input.vesselImo),
          vesselComment: optionalText(input.vesselComment),
          dockId: input.dockId,
          expectedStartAt: input.expectedStartAt,
          productLots,
          shifts,
        },
        client,
      )

      if (result.kind === 'DUPLICATE_ID') {
        return false
      }
      if (result.kind === 'DUPLICATE_LOT_IDENTITY') {
        // The rules already compare identities; this is the database agreeing, as a last resort.
        throwPreparationIssues([duplicateLotIssue('productLots.0.productName')])
      }
      if (result.kind !== 'CREATED') {
        throw new Error(`Unexpected planned discharge creation result: ${result.kind}`)
      }

      return true
    })

    const discharge = await this.dischargeRepository.findDetail(id)
    if (!discharge) {
      throw new Error(`Planned discharge ${id} is missing after its creation`)
    }

    return { discharge, created }
  }

  /**
   * Locks the dock, then the customers, then the responsibles, in the order every preparation write
   * takes them, and refuses whatever is missing, archived, or not eligible once the locks are held.
   */
  private async checkReferencesUnderLock(
    input: CreatePlannedDischargeInput,
    client: TransactionClientContract,
  ) {
    const docks = await this.preparationRepository.lockDocks([input.dockId], client)
    const customers = await this.preparationRepository.lockCustomers(
      [...new Set(input.productLots.map((productLot) => productLot.customerId))],
      client,
    )
    const users = await this.preparationRepository.lockUsers(
      [...new Set(input.shifts.map((shift) => shift.responsibleUserId))],
      client,
    )
    const issues: PreparationIssue[] = []

    if (docks.get(input.dockId.toLowerCase())?.status !== 'AVAILABLE') {
      issues.push(unavailableDockIssue())
    }
    input.productLots.forEach((productLot, index) => {
      if (customers.get(productLot.customerId.toLowerCase())?.status !== 'AVAILABLE') {
        issues.push(unavailableCustomerIssue(`productLots.${index}.customerId`))
      }
    })
    input.shifts.forEach((shift, index) => {
      const responsible = users.get(shift.responsibleUserId.toLowerCase())
      if (!responsible || !isEligibleShiftResponsible(responsible)) {
        issues.push({
          field: `shifts.${index}.responsibleUserId`,
          rule: 'eligibleShiftResponsible',
          message: 'This user can no longer be responsible for a shift',
        })
      }
    })

    throwPreparationIssues(issues)
  }
}
