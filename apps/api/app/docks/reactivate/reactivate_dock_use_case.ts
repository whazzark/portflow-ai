import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import { DockAlreadyAvailableException, DockNotFoundException } from '#docks/shared/dock_exceptions'
import DockRepository from '#docks/shared/repositories/dock_repository'

export type ReactivateDockInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateDockUseCase {
  constructor(private dockRepository: DockRepository) {}

  async handle(input: ReactivateDockInput) {
    const dock = await this.dockRepository.findById(input.id)
    if (!dock) {
      throw new DockNotFoundException()
    }
    if (dock.status === 'AVAILABLE') {
      throw new DockAlreadyAvailableException()
    }

    const result = await this.dockRepository.reactivateArchived({
      id: input.id,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
    if (result.kind === 'NOT_FOUND') {
      throw new DockNotFoundException()
    }
    if (result.kind === 'ALREADY_AVAILABLE') {
      throw new DockAlreadyAvailableException()
    }
    return result.dock
  }
}
