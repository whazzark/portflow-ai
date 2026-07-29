import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import {
  DockAlreadyArchivedException,
  DockInUseException,
  DockNotFoundException,
} from '#docks/shared/dock_exceptions'
import DockRepository from '#docks/shared/repositories/dock_repository'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

export type ArchiveDockInput = {
  id: string
  archivedByUserId: string
  archivedAt: DateTime
  comment?: string | null
}

@inject()
export default class ArchiveDockUseCase {
  constructor(
    private dockRepository: DockRepository,
    private usageChecker: SiteReferenceUsageChecker,
  ) {}

  async handle(input: ArchiveDockInput) {
    const dock = await this.dockRepository.findById(input.id)

    if (!dock) {
      throw new DockNotFoundException()
    }

    if (dock.status === 'ARCHIVED') {
      throw new DockAlreadyArchivedException()
    }

    const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
      referenceType: 'DOCK',
      referenceIds: [input.id],
    })

    if (usedIds.has(input.id)) {
      throw new DockInUseException()
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

    return result.dock
  }
}
