import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

import ArchiveWarehouseUseCase from '#warehouses/archive/archive_warehouse_use_case'
import ArchiveWarehousesUseCase from '#warehouses/archive/archive_warehouses_use_case'
import CreateWarehouseUseCase from '#warehouses/create/create_warehouse_use_case'
import ListWarehousesUseCase from '#warehouses/list/list_warehouses_use_case'
import ReactivateWarehouseUseCase from '#warehouses/reactivate/reactivate_warehouse_use_case'
import ReactivateWarehousesUseCase from '#warehouses/reactivate/reactivate_warehouses_use_case'
import WarehousePolicy from '#warehouses/shared/warehouse_policy'
import WarehouseTransformer from '#warehouses/shared/warehouse_transformer'
import {
  archiveWarehousesValidator,
  archiveWarehouseValidator,
  createWarehouseValidator,
  reactivateWarehousesValidator,
  reactivateWarehouseValidator,
  updateWarehouseValidator,
} from '#warehouses/shared/warehouse_validator'
import UpdateWarehouseUseCase from '#warehouses/update/update_warehouse_use_case'

@inject()
export default class WarehousesController {
  constructor(
    private listWarehousesUseCase: ListWarehousesUseCase,
    private createWarehouseUseCase: CreateWarehouseUseCase,
    private updateWarehouseUseCase: UpdateWarehouseUseCase,
    private archiveUseCase: ArchiveWarehouseUseCase,
    private archiveManyUseCase: ArchiveWarehousesUseCase,
    private reactivateUseCase: ReactivateWarehouseUseCase,
    private reactivateManyUseCase: ReactivateWarehousesUseCase,
  ) {}

  async index({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('list')
    const warehouses = await this.listWarehousesUseCase.handle()
    return serialize(WarehouseTransformer.transform(warehouses))
  }

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('create')

    const payload = await request.validateUsing(createWarehouseValidator)

    const warehouse = await this.createWarehouseUseCase.handle({
      name: payload.name,
      points: payload.footprint.points,
    })

    response.status(201)

    return serialize(WarehouseTransformer.transform(warehouse))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(WarehousePolicy).authorize('update')

    const payload = await request.validateUsing(updateWarehouseValidator)

    const warehouse = await this.updateWarehouseUseCase.handle({
      id: params.id,
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.footprint === undefined ? {} : { points: payload.footprint.points }),
    })

    return serialize(WarehouseTransformer.transform(warehouse))
  }

  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehousePolicy).authorize('archive')

    const payload = await request.validateUsing(archiveWarehouseValidator)

    const result = await this.archiveUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    // Sibling single-archive endpoints return the bare resource, but a warehouse archival also
    // changes rows the resource alone cannot account for. `archivedDoorCount` reports what the
    // cascade actually did at submission time, which is not always the count the confirmation
    // showed (research D9), so the success message can tell the truth rather than repeat a guess.
    return serialize({
      warehouse: WarehouseTransformer.transform(result.warehouse),
      archivedDoorCount: result.archivedDoorCount,
    })
  }

  async archiveMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehousePolicy).authorize('archive')

    const payload = await request.validateUsing(archiveWarehousesValidator)

    const result = await this.archiveManyUseCase.handle({
      ids: payload.ids,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedWarehouses: WarehouseTransformer.transform(result.updatedWarehouses),
      blockedWarehouses: result.blockedWarehouses,
    })
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehousePolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateWarehouseValidator)

    const result = await this.reactivateUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    // Mirrors the archive envelope: `reactivatedDoorCount` reports what the restore actually did at
    // submission time, which need not be the advisory count the confirmation showed.
    return serialize({
      warehouse: WarehouseTransformer.transform(result.warehouse),
      reactivatedDoorCount: result.reactivatedDoorCount,
    })
  }

  async reactivateMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehousePolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateWarehousesValidator)

    const result = await this.reactivateManyUseCase.handle({
      ids: payload.ids,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedWarehouses: WarehouseTransformer.transform(result.updatedWarehouses),
      blockedWarehouses: result.blockedWarehouses,
    })
  }
}
