import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import DockRepository, {
  type BulkDockLifecycleResult,
} from '#docks/shared/repositories/dock_repository'

export type ArchiveDocksInput = {
  ids: string[]
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveDocksUseCase {
  constructor(private dockRepository: DockRepository) {}

  handle(input: ArchiveDocksInput): Promise<BulkDockLifecycleResult> {
    return this.dockRepository.archiveAvailableMany({
      ids: input.ids,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })
  }
}
