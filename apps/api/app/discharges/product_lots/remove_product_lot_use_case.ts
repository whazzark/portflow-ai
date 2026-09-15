import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import {
  DischargeNotFoundException,
  LastProductLotException,
  ProductLotHasDoorAssignmentsException,
  ProductLotNotFoundException,
} from '#discharges/shared/discharge_exceptions'
import { lockPlannedDischarge } from '#discharges/shared/planned_discharge_guard'
import DischargePreparationRepository from '#discharges/shared/repositories/discharge_preparation_repository'
import DischargeRepository from '#discharges/shared/repositories/discharge_repository'

export type RemoveProductLotInput = {
  dischargeId: string
  productLotId: string
}

@inject()
export default class RemoveProductLotUseCase {
  constructor(
    private preparationRepository: DischargePreparationRepository,
    private dischargeRepository: DischargeRepository,
  ) {}

  /**
   * Removes a lot entered by mistake. A discharge keeps at least one lot, and a lot that has ever
   * had a warehouse door assigned is never deleted: its assignments are changed by their own slice,
   * not cascaded away from here.
   */
  async handle(input: RemoveProductLotInput) {
    await db.transaction(async (client) => {
      const discharge = await lockPlannedDischarge(
        this.preparationRepository,
        input.dischargeId,
        client,
      )
      const lots = await this.preparationRepository.listProductLots(discharge.id, client)
      const lot = lots.find((candidate) => candidate.id === input.productLotId.toLowerCase())

      if (!lot) {
        throw new ProductLotNotFoundException()
      }
      if (lots.length === 1) {
        throw new LastProductLotException()
      }
      if (await this.preparationRepository.hasDoorAssignments(lot.id, client)) {
        throw new ProductLotHasDoorAssignmentsException()
      }

      const result = await this.preparationRepository.deleteProductLot(
        { dischargeId: discharge.id, productLotId: lot.id },
        client,
      )
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
