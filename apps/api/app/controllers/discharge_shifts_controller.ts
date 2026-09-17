import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import AddPlannedShiftUseCase from '#discharges/shifts/add_planned_shift_use_case'
import CorrectPlannedShiftUseCase from '#discharges/shifts/correct_planned_shift_use_case'
import {
  plannedShiftAdditionValidator,
  plannedShiftCorrectionValidator,
} from '#discharges/shifts/planned_shift_validator'
import { parseInstant } from '#shared/validators/instant_validator'

/** A planned shift added or corrected as a whole, answered with its discharge's detail. */
@inject()
export default class DischargeShiftsController {
  constructor(
    private addPlannedShiftUseCase: AddPlannedShiftUseCase,
    private correctPlannedShiftUseCase: CorrectPlannedShiftUseCase,
  ) {}

  async store({ bouncer, params, request, response, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(plannedShiftAdditionValidator)
    const { discharge, created } = await this.addPlannedShiftUseCase.handle({
      ...payload,
      dischargeId: params.dischargeId,
      plannedStartAt: parseInstant(payload.plannedStartAt),
      plannedEndAt: parseInstant(payload.plannedEndAt),
      truckIds: payload.truckIds ?? [],
      warehouseDoorIds: payload.warehouseDoorIds ?? [],
      weighingAreaIds: payload.weighingAreaIds ?? [],
    })

    // A replayed addition is not a new shift: it answers 200 with the discharge it already changed.
    response.status(created ? 201 : 200)

    return serialize(DischargeDetailTransformer.transform(discharge))
  }

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
