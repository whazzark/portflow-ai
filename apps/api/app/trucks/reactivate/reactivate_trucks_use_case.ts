import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TruckRepository, {
  type BulkTruckLifecycleResult,
} from '#trucks/shared/repositories/truck_repository'

export type ReactivateTrucksInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateTrucksUseCase {
  constructor(private truckRepository: TruckRepository) {}

  handle(input: ReactivateTrucksInput): Promise<BulkTruckLifecycleResult> {
    return this.truckRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
