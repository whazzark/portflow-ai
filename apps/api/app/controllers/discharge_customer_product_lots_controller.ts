import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CorrectCustomerProductLotsUseCase from '#discharges/product_lots/correct_customer_product_lots_use_case'
import { customerProductLotsCorrectionValidator } from '#discharges/product_lots/product_lot_validator'
import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'

/** One customer's lots of a planned discharge, corrected at once and answered with the detail. */
@inject()
export default class DischargeCustomerProductLotsController {
  constructor(private correctCustomerProductLotsUseCase: CorrectCustomerProductLotsUseCase) {}

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(customerProductLotsCorrectionValidator)
    const detail = await this.correctCustomerProductLotsUseCase.handle({
      dischargeId: params.dischargeId,
      customerId: params.customerId,
      targetCustomerId: payload.customerId,
      productLots: payload.productLots,
      removedProductLotIds: payload.removedProductLotIds,
    })

    return serialize(DischargeDetailTransformer.transform(detail))
  }
}
