import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DockRepository, {
  type BulkDockLifecycleResult,
} from '#docks/shared/repositories/dock_repository'

export type ReactivateDocksInput = {
  ids: string[]
  reactivatedByUserId: string
  reactivatedAt: DateTime
  comment?: string | null
}

@inject()
export default class ReactivateDocksUseCase {
  constructor(private dockRepository: DockRepository) {}

  handle(input: ReactivateDocksInput): Promise<BulkDockLifecycleResult> {
    return this.dockRepository.reactivateArchivedMany({
      ids: input.ids,
      reactivatedAt: input.reactivatedAt,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivationComment: input.comment?.trim() || null,
    })
  }
}
