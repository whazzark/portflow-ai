import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import CreatePlannedDischargeUseCase from '#discharges/create/create_planned_discharge_use_case'
import { createPlannedDischargeValidator } from '#discharges/create/create_planned_discharge_validator'
import ListDischargesUseCase from '#discharges/list/list_discharges_use_case'
import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import DischargeTransformer from '#discharges/shared/discharge_transformer'
import ShowDischargeUseCase from '#discharges/show/show_discharge_use_case'
import CorrectDischargeIdentityUseCase from '#discharges/update/correct_discharge_identity_use_case'
import { correctDischargeIdentityValidator } from '#discharges/update/discharge_identity_validator'
import { parseInstant } from '#shared/validators/instant_validator'

@inject()
export default class DischargesController {
  constructor(
    private listDischargesUseCase: ListDischargesUseCase,
    private showDischargeUseCase: ShowDischargeUseCase,
    private createPlannedDischargeUseCase: CreatePlannedDischargeUseCase,
    private correctDischargeIdentityUseCase: CorrectDischargeIdentityUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('list')

    const discharges = await this.listDischargesUseCase.handle()

    return serialize(DischargeTransformer.transform(discharges))
  }

  async show({ bouncer, params, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('view')

    const discharge = await this.showDischargeUseCase.handle({ id: params.id })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('create')

    const payload = await request.validateUsing(createPlannedDischargeValidator)
    const { discharge, created } = await this.createPlannedDischargeUseCase.handle({
      ...payload,
      expectedStartAt: parseInstant(payload.expectedStartAt),
      shifts: payload.shifts.map((shift) => ({
        plannedStartAt: parseInstant(shift.plannedStartAt),
        plannedEndAt: parseInstant(shift.plannedEndAt),
        responsibleUserId: shift.responsibleUserId,
      })),
    })

    // A replayed creation is not a new resource: it answers 200 with the discharge it already made.
    response.status(created ? 201 : 200)

    return serialize(DischargeDetailTransformer.transform(discharge))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(correctDischargeIdentityValidator)
    const discharge = await this.correctDischargeIdentityUseCase.handle({
      ...payload,
      dischargeId: params.id,
      expectedStartAt: parseInstant(payload.expectedStartAt),
    })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }
}
