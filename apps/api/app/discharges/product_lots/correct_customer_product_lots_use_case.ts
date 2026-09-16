import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import { planCustomerProductLotsCorrection } from '#discharges/product_lots/customer_product_lots_rules'
import {
  normalizeProductLot,
  type ProductLotInput,
} from '#discharges/product_lots/product_lot_input'
import {
  DischargeNotFoundException,
  LastProductLotException,
  ProductLotHasDoorAssignmentsException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
import { throwPreparationIssues } from '#discharges/shared/discharge_preparation_issues'
import { duplicateLotIssue } from '#discharges/shared/discharge_preparation_rules'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type CorrectCustomerProductLotsInput = {
  dischargeId: string
  /** The customer whose lots are corrected, as the group reads today. */
  customerId: string
  /** The customer every corrected and added lot belongs to afterwards. */
  targetCustomerId: string
  productLots: Array<{ id?: string } & Omit<ProductLotInput, 'customerId'>>
  removedProductLotIds: string[]
}

@inject()
export default class CorrectCustomerProductLotsUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Corrects, adds, and removes one customer's lots of a planned discharge at once: every change
   * is written, or none. Corrected lots stay the same lots, so their warehouse door assignments
   * follow them.
   */
  async handle(input: CorrectCustomerProductLotsInput) {
    const productLots = input.productLots.map(({ id, ...values }) => ({
      ...(id === undefined ? {} : { id }),
      ...normalizeProductLot({ ...values, customerId: input.targetCustomerId }),
    }))

    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const lots = await this.preparationRepository.listProductLots(discharge.id, client)
      // The current customer is in use by these lots, so it cannot be archived: only a move to
      // another customer needs that customer locked and checked.
      const moves = input.targetCustomerId.toLowerCase() !== input.customerId.toLowerCase()
      const targetCustomer = moves
        ? ((await this.preparationRepository.lockCustomers([input.targetCustomerId], client)).get(
            input.targetCustomerId.toLowerCase(),
          ) ?? null)
        : null
      const lotIdsWithDoorAssignments =
        input.removedProductLotIds.length === 0
          ? new Set<string>()
          : await this.preparationRepository.listLotIdsWithDoorAssignments(
              input.removedProductLotIds,
              client,
            )

      const plan = planCustomerProductLotsCorrection(
        {
          customerId: input.customerId,
          targetCustomerId: input.targetCustomerId,
          productLots,
          removedProductLotIds: input.removedProductLotIds,
        },
        lots,
        lotIdsWithDoorAssignments,
        targetCustomer,
      )

      if (plan.kind === 'LOT_NOT_FOUND') {
        throw new ProductLotNotFoundException()
      }
      if (plan.kind === 'ISSUES') {
        throwPreparationIssues(plan.issues)
      }
      if (plan.kind === 'LAST_LOT') {
        throw new LastProductLotException()
      }
      if (plan.kind !== 'PLAN') {
        return
      }

      const result = await this.preparationRepository.writeCustomerProductLotsCorrection(
        {
          dischargeId: discharge.id,
          removals: plan.removals,
          corrections: plan.corrections,
          insertions: plan.insertions,
        },
        client,
      )
      if (result.kind === 'DUPLICATE_LOT_IDENTITY') {
        // The rules already compare identities; this is the database agreeing, as a last resort.
        throwPreparationIssues([duplicateLotIssue('productLots.0.productName')])
      }
      if (result.kind === 'HAS_DOOR_ASSIGNMENTS') {
        throw new ProductLotHasDoorAssignmentsException()
      }
    })

    const discharge = await this.dischargeRepository.findDetail(input.dischargeId)
    if (!discharge) {
      throw new DischargeNotFoundException()
    }

    return discharge
  }
}
