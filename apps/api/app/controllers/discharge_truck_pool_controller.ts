import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import DischargeDetailTransformer from '#discharges/shared/discharge_detail_transformer'
import DischargePolicy from '#discharges/shared/discharge_policy'
import TruckCandidateTransformer from '#discharges/shared/truck_candidate_transformer'
import ListTruckCandidatesUseCase from '#discharges/truck_pool/list_truck_candidates_use_case'
import ReserveTrucksUseCase from '#discharges/truck_pool/reserve_trucks_use_case'
import { truckIdsValidator } from '#discharges/truck_pool/truck_pool_validators'
import WithdrawTrucksUseCase from '#discharges/truck_pool/withdraw_trucks_use_case'

/** A planned discharge's truck pool, each change answered with the whole discharge detail. */
@inject()
export default class DischargeTruckPoolController {
  constructor(
    private listTruckCandidatesUseCase: ListTruckCandidatesUseCase,
    private reserveTrucksUseCase: ReserveTrucksUseCase,
    private withdrawTrucksUseCase: WithdrawTrucksUseCase,
  ) {}

  async candidates({ bouncer, params, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const candidates = await this.listTruckCandidatesUseCase.handle({
      dischargeId: params.dischargeId,
    })

    return serialize(TruckCandidateTransformer.transform(candidates))
  }

  async store({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(truckIdsValidator)
    const detail = await this.reserveTrucksUseCase.handle({
      dischargeId: params.dischargeId,
      truckIds: payload.truckIds,
    })

    return serialize(DischargeDetailTransformer.transform(detail))
  }

  async withdraw({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DischargePolicy).authorize('update')

    const payload = await request.validateUsing(truckIdsValidator)
    const detail = await this.withdrawTrucksUseCase.handle({
      dischargeId: params.dischargeId,
      truckIds: payload.truckIds,
    })

    return serialize(DischargeDetailTransformer.transform(detail))
  }
}
