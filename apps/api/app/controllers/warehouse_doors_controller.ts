import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import ArchiveWarehouseDoorUseCase from '#warehouse_doors/archive/archive_warehouse_door_use_case'
import ArchiveWarehouseDoorsUseCase from '#warehouse_doors/archive/archive_warehouse_doors_use_case'
import ListAvailableWarehouseDoorsUseCase from '#warehouse_doors/available/list_available_warehouse_doors_use_case'
import CreateWarehouseDoorUseCase from '#warehouse_doors/create/create_warehouse_door_use_case'
import ReactivateWarehouseDoorUseCase from '#warehouse_doors/reactivate/reactivate_warehouse_door_use_case'
import WarehouseDoorPolicy from '#warehouse_doors/shared/warehouse_door_policy'
import WarehouseDoorTransformer from '#warehouse_doors/shared/warehouse_door_transformer'
import {
  archiveWarehouseDoorsValidator,
  archiveWarehouseDoorValidator,
  createWarehouseDoorValidator,
  reactivateWarehouseDoorValidator,
  updateWarehouseDoorValidator,
} from '#warehouse_doors/shared/warehouse_door_validator'
import UpdateWarehouseDoorUseCase from '#warehouse_doors/update/update_warehouse_door_use_case'

@inject()
export default class WarehouseDoorsController {
  constructor(
    private listAvailableWarehouseDoorsUseCase: ListAvailableWarehouseDoorsUseCase,
    private createWarehouseDoorUseCase: CreateWarehouseDoorUseCase,
    private updateWarehouseDoorUseCase: UpdateWarehouseDoorUseCase,
    private archiveWarehouseDoorUseCase: ArchiveWarehouseDoorUseCase,
    private archiveWarehouseDoorsUseCase: ArchiveWarehouseDoorsUseCase,
    private reactivateWarehouseDoorUseCase: ReactivateWarehouseDoorUseCase,
  ) {}

  async store({ bouncer, request, response, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('create')

    const payload = await request.validateUsing(createWarehouseDoorValidator)

    const door = await this.createWarehouseDoorUseCase.handle(payload)

    response.status(201)

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  async update({ bouncer, params, request, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('update')

    const payload = await request.validateUsing(updateWarehouseDoorValidator)

    const door = await this.updateWarehouseDoorUseCase.handle({ id: params.id, ...payload })

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  /**
   * Returns the bare door, unlike `warehouses.archive`, which wraps its resource to report how many
   * doors the cascade took with it. A door archival cascades onto nothing, so there is no second
   * number to report and no envelope to justify.
   */
  async archive({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehouseDoorPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveWarehouseDoorValidator)

    const door = await this.archiveWarehouseDoorUseCase.handle({
      id: params.id,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  /**
   * Reports partial success rather than refusing the submission because one door is ineligible:
   * `updatedDoors` holds what was archived, in submission order, and `blockedDoors` names each door
   * left unchanged with exactly one reason.
   */
  async archiveMany({ auth, bouncer, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehouseDoorPolicy).authorize('archive')

    const payload = await request.validateUsing(archiveWarehouseDoorsValidator)

    const result = await this.archiveWarehouseDoorsUseCase.handle({
      ids: payload.ids,
      archivedByUserId: user.id,
      archivedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize({
      updatedDoors: WarehouseDoorTransformer.transform(result.updatedDoors),
      blockedDoors: result.blockedDoors,
    })
  }

  async reactivate({ auth, bouncer, params, request, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    await bouncer.with(WarehouseDoorPolicy).authorize('reactivate')

    const payload = await request.validateUsing(reactivateWarehouseDoorValidator)

    const door = await this.reactivateWarehouseDoorUseCase.handle({
      id: params.id,
      reactivatedByUserId: user.id,
      reactivatedAt: DateTime.now(),
      comment: payload.comment,
    })

    return serialize(WarehouseDoorTransformer.transform(door))
  }

  async available({ bouncer, serialize }: HttpContext) {
    await bouncer.with(WarehouseDoorPolicy).authorize('listAvailable')

    const doors = await this.listAvailableWarehouseDoorsUseCase.handle()

    return serialize(WarehouseDoorTransformer.transform(doors))
  }
}
