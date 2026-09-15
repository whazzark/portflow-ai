import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { Decimal } from 'decimal.js'

import { DischargeNotFoundException } from '#discharges/shared/discharge_exceptions'
import {
  throwPreparationIssues,
  unavailableCustomerIssue,
} from '#discharges/shared/discharge_preparation_issues'
import {
  duplicateLotIssue,
  findLotIdentityClash,
} from '#discharges/shared/discharge_preparation_rules'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type ProductLotInput = {
  customerId: string
  productName: string
  expectedQuantityTonnes: string
  description: string | null
}

export type AddProductLotInput = ProductLotInput & { dischargeId: string }

export function normalizeProductLot(input: ProductLotInput) {
  return {
    customerId: input.customerId,
    productName: input.productName.trim(),
    expectedQuantityTonnes: new Decimal(input.expectedQuantityTonnes),
    description: input.description?.trim() || null,
  }
}

@inject()
export default class AddProductLotUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  async handle(input: AddProductLotInput) {
    const lot = normalizeProductLot(input)

    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const lots = await this.preparationRepository.listProductLots(discharge.id, client)

      if (findLotIdentityClash(lots, lot)) {
        throwPreparationIssues([duplicateLotIssue('productName')])
      }

      const customers = await this.preparationRepository.lockCustomers([lot.customerId], client)
      if (customers.get(lot.customerId.toLowerCase())?.status !== 'AVAILABLE') {
        throwPreparationIssues([unavailableCustomerIssue('customerId')])
      }

      const result = await this.preparationRepository.insertProductLot(
        { ...lot, dischargeId: discharge.id },
        client,
      )
      if (result.kind === 'DUPLICATE_LOT_IDENTITY') {
        throwPreparationIssues([duplicateLotIssue('productName')])
      }
    })

    const discharge = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
