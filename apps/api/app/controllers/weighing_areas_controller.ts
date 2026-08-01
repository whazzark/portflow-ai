import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import ArchiveWeighingAreaUseCase from '#weighing_areas/archive/archive_weighing_area_use_case'
import ListAvailableWeighingAreasUseCase from '#weighing_areas/available/list_available_weighing_areas_use_case'
import CreateWeighingAreaUseCase from '#weighing_areas/create/create_weighing_area_use_case'
import ListWeighingAreasUseCase from '#weighing_areas/list/list_weighing_areas_use_case'
import ReactivateWeighingAreaUseCase from '#weighing_areas/reactivate/reactivate_weighing_area_use_case'
import WeighingAreaPolicy from '#weighing_areas/shared/weighing_area_policy'
import WeighingAreaTransformer from '#weighing_areas/shared/weighing_area_transformer'
import {
  archiveWeighingAreaValidator,
  createWeighingAreaValidator,
  reactivateWeighingAreaValidator,
  updateWeighingAreaValidator,
} from '#weighing_areas/shared/weighing_area_validator'
import UpdateWeighingAreaUseCase from '#weighing_areas/update/update_weighing_area_use_case'

@inject()
export default class WeighingAreasController {
  constructor(
    private create: CreateWeighingAreaUseCase,
    private list: ListWeighingAreasUseCase,
    private listAvailable: ListAvailableWeighingAreasUseCase,
    private updateUseCase: UpdateWeighingAreaUseCase,
    private archiveUseCase: ArchiveWeighingAreaUseCase,
    private reactivateUseCase: ReactivateWeighingAreaUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WeighingAreaPolicy).authorize('list')

    const areas = await this.list.handle()

    return serialize(WeighingAreaTransformer.transform(areas))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WeighingAreaPolicy).authorize('listAvailable')

    const areas = await this.listAvailable.handle()

    return serialize(WeighingAreaTransformer.transform(areas))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(WeighingAreaPolicy).authorize('create')

    const payload = await request.validateUsing(createWeighingAreaValidator)

    const area = await this.create.handle(payload)

    response.status(201)

    return serialize(WeighingAreaTransformer.transform(area))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(WeighingAreaPolicy).authorize('update')

    const payload = await request.validateUsing(updateWeighingAreaValidator)

    const area = await this.updateUseCase.handle({ id: params.id, ...payload })

    return serialize(WeighingAreaTransformer.transform(area))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WeighingAreaPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveWeighingAreaValidator)

    const area = await this.archiveUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(WeighingAreaTransformer.transform(area))
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WeighingAreaPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateWeighingAreaValidator)

    const area = await this.reactivateUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(WeighingAreaTransformer.transform(area))
  }
}
