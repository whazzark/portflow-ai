import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import WeighingAreaRepository, {
  type BulkWeighingAreaLifecycleResult,
} from '#weighing_areas/shared/repositories/weighing_area_repository'

export type ReactivateWeighingAreasInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateWeighingAreasUseCase {
  constructor(private weighingAreaRepository: WeighingAreaRepository) {}

  handle(input: ReactivateWeighingAreasInput): Promise<BulkWeighingAreaLifecycleResult> {
    return this.weighingAreaRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
