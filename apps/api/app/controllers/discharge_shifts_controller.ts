import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import CorrectPlannedShiftUseCase from '#discharges/shifts/correct_planned_shift_use_case'
import { plannedShiftCorrectionValidator } from '#discharges/shifts/planned_shift_validator'
import { parseInstant } from '#shared/validators/instant_validator'

/** A planned shift corrected as a whole, answered with its discharge's detail. */
@inject()
export default class DischargeShiftsController {
  constructor(private correctPlannedShiftUseCase: CorrectPlannedShiftUseCase) {}

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(plannedShiftCorrectionValidator)
    const detail = await this.correctPlannedShiftUseCase.handle({
      ...payload,
      dischargeId: params.dischargeId,
      shiftId: params.shiftId,
      plannedStartAt: parseInstant(payload.plannedStartAt),
      plannedEndAt: parseInstant(payload.plannedEndAt),
    })

    return serialize(DischargeDetailTransformer.transform(detail))
  }
}
