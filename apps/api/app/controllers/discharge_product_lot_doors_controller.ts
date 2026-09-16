import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import ChangeLotWarehouseDoorsUseCase from '#discharges/warehouse_doors/change_lot_warehouse_doors_use_case'
import { lotWarehouseDoorsValidator } from '#discharges/warehouse_doors/lot_warehouse_doors_validator'

/** A planned discharge's lot doors, each change answered with the whole discharge detail. */
@inject()
export default class DischargeProductLotDoorsController {
  constructor(private changeLotWarehouseDoorsUseCase: ChangeLotWarehouseDoorsUseCase) {}

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(lotWarehouseDoorsValidator)
    const discharge = await this.changeLotWarehouseDoorsUseCase.handle({
      ...payload,
      dischargeId: params.dischargeId,
      productLotId: params.id,
    })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }
}
