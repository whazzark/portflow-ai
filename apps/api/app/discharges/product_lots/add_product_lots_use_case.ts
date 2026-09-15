import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import {
  normalizeProductLot,
  type ProductLotInput,
} from '#discharges/product_lots/product_lot_input'
import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import {
  type PreparationIssue,
  throwPreparationIssues,
  unavailableCustomerIssue,
} from '#discharges/shared/discharge_preparation_issues'
import {
  duplicateLotIssue,
  findDuplicateLotIssues,
  findLotIdentityClash,
} from '#discharges/shared/discharge_preparation_rules'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type AddProductLotsInput = { dischargeId: string; productLots: ProductLotInput[] }

/**
 * Adds several lots to a planned discharge at once. Every refused lot is reported at its position,
 * and a single refusal writes none of them.
 */
@inject()
export default class AddProductLotsUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  async handle(input: AddProductLotsInput) {
    const productLots = input.productLots.map(normalizeProductLot)

    throwPreparationIssues(findDuplicateLotIssues(productLots))

    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const existing = await this.preparationRepository.listProductLots(discharge.id, client)
      const customers = await this.preparationRepository.lockCustomers(
        [...new Set(productLots.map((productLot) => productLot.customerId))],
        client,
      )
      const issues: PreparationIssue[] = []

      productLots.forEach((productLot, index) => {
        if (customers.get(productLot.customerId.toLowerCase())?.status !== 'AVAILABLE') {
          issues.push(unavailableCustomerIssue(`productLots.${index}.customerId`))
        }
        if (findLotIdentityClash(existing, productLot)) {
          issues.push(duplicateLotIssue(`productLots.${index}.productName`))
        }
      })
      throwPreparationIssues(issues)

      const result = await this.preparationRepository.insertProductLots(
        { dischargeId: discharge.id, productLots },
        client,
      )
      if (result.kind === 'DUPLICATE_LOT_IDENTITY') {
        // The rules already compare identities; this is the database agreeing, as a last resort.
        throwPreparationIssues([duplicateLotIssue('productLots.0.productName')])
      }
    })

    const discharge = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
