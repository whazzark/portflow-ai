import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import SelectShiftTrucksUseCase from '#discharges/truck_pool/select_shift_trucks_use_case'
import { shiftTruckSelectionValidator } from '#discharges/truck_pool/truck_pool_validators'

/** A planned shift's trucks, chosen from its discharge's pool and answered with the detail. */
@inject()
export default class DischargeShiftTrucksController {
  constructor(private selectShiftTrucksUseCase: SelectShiftTrucksUseCase) {}

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(shiftTruckSelectionValidator)
    const detail = await this.selectShiftTrucksUseCase.handle({
      dischargeId: params.dischargeId,
      shiftId: params.shiftId,
      truckIds: payload.truckIds,
    })

    return serialize(DischargeDetailTransformer.transform(detail))
  }
}
