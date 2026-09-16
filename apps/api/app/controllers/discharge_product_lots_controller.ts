import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import AddProductLotsUseCase from '#discharges/product_lots/add_product_lots_use_case'
import CorrectProductLotUseCase from '#discharges/product_lots/correct_product_lot_use_case'
import {
  addProductLotsValidator,
  productLotValidator,
} from '#discharges/product_lots/product_lot_validator'
import RemoveProductLotUseCase from '#discharges/product_lots/remove_product_lot_use_case'
import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'

/** A planned discharge's product lots, each change answered with the whole discharge detail. */
@inject()
export default class DischargeProductLotsController {
  constructor(
    private addProductLotsUseCase: AddProductLotsUseCase,
    private correctProductLotUseCase: CorrectProductLotUseCase,
    private removeProductLotUseCase: RemoveProductLotUseCase,
  ) {}

  async store({ bouncer, params, request, response, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const { productLots } = await request.validateUsing(addProductLotsValidator)
    const discharge = await this.addProductLotsUseCase.handle({
      dischargeId: params.dischargeId,
      productLots,
    })

    response.status(201)

    return serialize(DischargeDetailTransformer.transform(discharge))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(productLotValidator)
    const discharge = await this.correctProductLotUseCase.handle({
      ...payload,
      dischargeId: params.dischargeId,
      productLotId: params.id,
    })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }

  async destroy({ bouncer, params, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const discharge = await this.removeProductLotUseCase.handle({
      dischargeId: params.dischargeId,
      productLotId: params.id,
    })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }
}
