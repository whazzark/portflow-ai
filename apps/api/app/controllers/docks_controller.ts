import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import ArchiveDockUseCase from '#docks/archive/archive_dock_use_case'
import ListAvailableDocksUseCase from '#docks/available/list_available_docks_use_case'
import CreateDockUseCase from '#docks/create/create_dock_use_case'
import ListDocksUseCase from '#docks/list/list_docks_use_case'
import ReactivateDockUseCase from '#docks/reactivate/reactivate_dock_use_case'
import DockPolicy from '#docks/shared/dock_policy'
import DockTransformer from '#docks/shared/dock_transformer'
import {
  archiveDockValidator,
  createDockValidator,
  reactivateDockValidator,
  updateDockValidator,
} from '#docks/shared/dock_validator'
import UpdateDockUseCase from '#docks/update/update_dock_use_case'

@inject()
export default class DocksController {
  constructor(
    private createDockUseCase: CreateDockUseCase,
    private listDocksUseCase: ListDocksUseCase,
    private listAvailableDocksUseCase: ListAvailableDocksUseCase,
    private updateDockUseCase: UpdateDockUseCase,
    private archiveDockUseCase: ArchiveDockUseCase,
    private reactivateDockUseCase: ReactivateDockUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(DockPolicy).authorize('list')

    const docks = await this.listDocksUseCase.handle()

    return serialize(DockTransformer.transform(docks))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(DockPolicy).authorize('listAvailable')

    const docks = await this.listAvailableDocksUseCase.handle()

    return serialize(DockTransformer.transform(docks))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(DockPolicy).authorize('create')

    const payload = await request.validateUsing(createDockValidator)

    const dock = await this.createDockUseCase.handle(payload)

    response.status(201)

    return serialize(DockTransformer.transform(dock))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(DockPolicy).authorize('update')

    const payload = await request.validateUsing(updateDockValidator)

    const dock = await this.updateDockUseCase.handle({ id: params.id, ...payload })

    return serialize(DockTransformer.transform(dock))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(DockPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveDockValidator)

    const dock = await this.archiveDockUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(DockTransformer.transform(dock))
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(DockPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateDockValidator)

    const dock = await this.reactivateDockUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(DockTransformer.transform(dock))
  }
}
