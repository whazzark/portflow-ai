import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import CheckDischargeStartUseCase from '#discharges/start/check_discharge_start_use_case'
import StartDischargeUseCase from '#discharges/start/start_discharge_use_case'

/** The review of a planned discharge's start, and the start itself. */
@inject()
export default class DischargeStartController {
  constructor(
    private checkDischargeStartUseCase: CheckDischargeStartUseCase,
    private startDischargeUseCase: StartDischargeUseCase,
  ) {}

  async check({ bouncer, params }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('start')

    return { data: await this.checkDischargeStartUseCase.handle({ dischargeId: params.id }) }
  }

  async store({ auth, bouncer, params, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('start')

    const discharge = await this.startDischargeUseCase.handle({
      dischargeId: params.id,
      userId: auth.getUserOrFail().id,
    })

    return serialize(DischargeDetailTransformer.transform(discharge))
  }
}
