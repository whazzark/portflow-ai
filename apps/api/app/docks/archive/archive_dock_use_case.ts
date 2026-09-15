import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import {
  DockAlreadyArchivedException,
  DockInUseException,
  DockNotFoundException,
} from '#docks/shared/dock_exceptions'
import DockRepository from '#docks/shared/repositories/dock_repository'

export type ArchiveDockInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveDockUseCase {
  constructor(private dockRepository: DockRepository) {}

  async handle(input: ArchiveDockInput) {
    const dock = await this.dockRepository.findById(input.id)

    if (!dock) {
      throw new DockNotFoundException()
    }

    if (dock.status === 'ARCHIVED') {
      throw new DockAlreadyArchivedException()
    }

    const result = await this.dockRepository.archiveAvailable({
      id: input.id,
      archivedAt: input.archivedAt,
      archivedByUserId: input.archivedByUserId,
      archiveComment: input.comment?.trim() || null,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new DockNotFoundException()
    }

    if (result.kind === 'ALREADY_ARCHIVED') {
      throw new DockAlreadyArchivedException()
    }

    // Decided by the repository under the dock's lock, never from a usage read beforehand.
    if (result.kind === 'IN_USE') {
      throw new DockInUseException()
    }

    return result.dock
  }
}
