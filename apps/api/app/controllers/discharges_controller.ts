import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListDischargesUseCase from '#discharges/list/list_discharges_use_case'
import DischargePolicy from '#discharges/shared/discharge_policy'
import DischargeTransformer from '#discharges/shared/discharge_transformer'

@inject()
export default class DischargesController {
  constructor(private listDischargesUseCase: ListDischargesUseCase) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('list')

    const discharges = await this.listDischargesUseCase.handle()

    return serialize(DischargeTransformer.transform(discharges))
  }
}
