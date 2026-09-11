import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListDischargesUseCase from '#discharges/list/list_discharges_use_case'
import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import DischargeTransformer from '#discharges/shared/discharge_transformer'
import ShowDischargeUseCase from '#discharges/show/show_discharge_use_case'

@inject()
export default class DischargesController {
  constructor(
    private listDischargesUseCase: ListDischargesUseCase,
    private showDischargeUseCase: ShowDischargeUseCase,
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
}
