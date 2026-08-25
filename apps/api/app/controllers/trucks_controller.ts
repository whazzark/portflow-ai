import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import ArchiveTruckUseCase from '#trucks/archive/archive_truck_use_case'
import ArchiveTrucksUseCase from '#trucks/archive/archive_trucks_use_case'
import ListAvailableTrucksUseCase from '#trucks/available/list_available_trucks_use_case'
import CreateTruckUseCase from '#trucks/create/create_truck_use_case'
import ListTrucksUseCase from '#trucks/list/list_trucks_use_case'
import ReactivateTruckUseCase from '#trucks/reactivate/reactivate_truck_use_case'
import ReactivateTrucksUseCase from '#trucks/reactivate/reactivate_trucks_use_case'
import TruckPolicy from '#trucks/shared/truck_policy'
import TruckTransformer from '#trucks/shared/truck_transformer'
import {
  archiveTrucksValidator,
  archiveTruckValidator,
  createTruckValidator,
  reactivateTrucksValidator,
  reactivateTruckValidator,
  suspendTruckValidator,
  updateTruckValidator,
} from '#trucks/shared/truck_validator'
import SuspendTruckUseCase from '#trucks/suspend/suspend_truck_use_case'
import ListSuspendedTrucksUseCase from '#trucks/suspended/list_suspended_trucks_use_case'
import UpdateTruckUseCase from '#trucks/update/update_truck_use_case'

@inject()
export default class TrucksController {
  constructor(
    private listTrucksUseCase: ListTrucksUseCase,
    private listAvailableTrucksUseCase: ListAvailableTrucksUseCase,
    private createTruckUseCase: CreateTruckUseCase,
    private updateTruckUseCase: UpdateTruckUseCase,
    private archiveTruckUseCase: ArchiveTruckUseCase,
    private archiveTrucksUseCase: ArchiveTrucksUseCase,
    private reactivateTruckUseCase: ReactivateTruckUseCase,
    private reactivateTrucksUseCase: ReactivateTrucksUseCase,
    private suspendTruckUseCase: SuspendTruckUseCase,
    private listSuspendedTrucksUseCase: ListSuspendedTrucksUseCase,
  ) {}

  async suspended({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('listSuspended')

    const trucks = await this.listSuspendedTrucksUseCase.handle()

    return serialize(TruckTransformer.transform(trucks).useVariant('toOperationalView'))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('create')

    const payload = await request.validateUsing(createTruckValidator)

    const truck = await this.createTruckUseCase.handle({
      registration: payload.registration,
      vehicleModel: payload.vehicleModel ?? null,
      capacityTonnes: payload.capacityTonnes,
      transportCompanyId: payload.transportCompanyId,
    })

    response.status(201)

    return serialize(TruckTransformer.transform(truck))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('update')

    const payload = await request.validateUsing(updateTruckValidator)

    const truck = await this.updateTruckUseCase.handle({
      id: params.id,
      registration: payload.registration,
      vehicleModel: payload.vehicleModel,
      capacityTonnes: payload.capacityTonnes,
      transportCompanyId: payload.transportCompanyId,
    })

    return serialize(TruckTransformer.transform(truck))
  }

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('list')

    const trucks = await this.listTrucksUseCase.handle()

    return serialize(TruckTransformer.transform(trucks))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(TruckPolicy).authorize('listAvailable')

    const trucks = await this.listAvailableTrucksUseCase.handle()

    return serialize(TruckTransformer.transform(trucks))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TruckPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveTruckValidator)

    const truck = await this.archiveTruckUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(TruckTransformer.transform(truck))
  }

  async archiveMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TruckPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveTrucksValidator)
    const result = await this.archiveTrucksUseCase.handle({
      ids: payload.ids,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedTrucks: TruckTransformer.transform(result.updatedTrucks),
      blockedTrucks: result.blockedTrucks,
    })
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TruckPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateTruckValidator)

    const truck = await this.reactivateTruckUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(TruckTransformer.transform(truck))
  }

  async reactivateMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TruckPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateTrucksValidator)
    const result = await this.reactivateTrucksUseCase.handle({
      ids: payload.ids,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedTrucks: TruckTransformer.transform(result.updatedTrucks),
      blockedTrucks: result.blockedTrucks,
    })
  }

  async suspend({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(TruckPolicy).authorize('suspend')

    const payload = await request.validateUsing(suspendTruckValidator)

    const truck = await this.suspendTruckUseCase.handle({
      id: params.id,
      suspendedByUserId: user.id,
      suspendedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(TruckTransformer.transform(truck))
  }
}
