import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import WarehouseRepository, {
  type BulkWarehouseLifecycleResult,
} from '#warehouses/shared/repositories/warehouse_repository'

export type ReactivateWarehousesInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateWarehousesUseCase {
  constructor(private repository: WarehouseRepository) {}

  handle(input: ReactivateWarehousesInput): Promise<BulkWarehouseLifecycleResult> {
    return this.repository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
