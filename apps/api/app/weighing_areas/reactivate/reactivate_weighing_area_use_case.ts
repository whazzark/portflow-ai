import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'
import {
  WeighingAreaAlreadyAvailableException,
  WeighingAreaNotFoundException,
} from '#weighing_areas/shared/weighing_area_exceptions'

export type ReactivateWeighingAreaInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateWeighingAreaUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  async handle(input: ReactivateWeighingAreaInput) {
    const area = await this.repository.findById(input.id)

    if (!area) {
      throw new WeighingAreaNotFoundException()
    }

    if (area.status === 'AVAILABLE') {
      throw new WeighingAreaAlreadyAvailableException()
    }

    const result = await this.repository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new WeighingAreaNotFoundException()
    }

    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new WeighingAreaAlreadyAvailableException()
    }

    return result.weighingArea
  }
}
