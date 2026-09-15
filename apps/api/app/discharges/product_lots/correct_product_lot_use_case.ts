import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import {
  normalizeProductLot,
  type ProductLotInput,
} from '#discharges/product_lots/product_lot_input'
import {
  DischargeNotFoundException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
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

export type CorrectProductLotInput = ProductLotInput & {
  dischargeId: string
  productLotId: string
}

@inject()
export default class CorrectProductLotUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Corrects a lot of a planned discharge. The lot stays the same lot, so its warehouse door
   * assignments follow it: nothing has been unloaded before the discharge starts, and the start
   * confirmation checks that lots and door assignments match.
   *
   * A customer is checked only when it changes: the current one is in use by this very lot, and a
   * reference in use cannot be archived.
   */
  async handle(input: CorrectProductLotInput) {
    const lot = normalizeProductLot(input)

    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const lots = await this.preparationRepository.listProductLots(discharge.id, client)
      const current = lots.find((candidate) => candidate.id === input.productLotId.toLowerCase())

      if (!current) {
        throw new ProductLotNotFoundException()
      }
      if (findLotIdentityClash(lots, lot, current.id)) {
        throwPreparationIssues([duplicateLotIssue('productName')])
      }

      if (lot.customerId.toLowerCase() !== current.customerId.toLowerCase()) {
        const customers = await this.preparationRepository.lockCustomers([lot.customerId], client)

        if (customers.get(lot.customerId.toLowerCase())?.status !== 'AVAILABLE') {
          throwPreparationIssues([unavailableCustomerIssue('customerId')])
        }
      }

      const result = await this.preparationRepository.updateProductLot(
        { ...lot, dischargeId: discharge.id, productLotId: current.id },
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
