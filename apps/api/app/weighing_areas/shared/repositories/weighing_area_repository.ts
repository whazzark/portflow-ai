import type { DateTime } from 'luxon'
import type WeighingArea from '#models/weighing_area'
import type { BulkWeighingAreaLifecycleBlocker } from '#weighing_areas/shared/weighing_area_lifecycle_blockers'

export type { BulkWeighingAreaLifecycleBlocker } from '#weighing_areas/shared/weighing_area_lifecycle_blockers'

export type CreateWeighingAreaCommand = { name: string; latitude: number; longitude: number }
export type UpdateWeighingAreaCommand = {
  id: string
  name?: string
  latitude?: number
  longitude?: number
}

export type ArchiveWeighingAreaCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ReactivateWeighingAreaCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type CreateWeighingAreaResult =
  | { kind: 'CREATED'; weighingArea: WeighingArea }
  | { kind: 'DUPLICATE_NAME' }

export type UpdateWeighingAreaResult =
  | { kind: 'UPDATED'; weighingArea: WeighingArea }
  | { kind: 'DUPLICATE_NAME' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }

export type ArchiveWeighingAreaResult =
  | { kind: 'ARCHIVED'; weighingArea: WeighingArea }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }

export type ReactivateWeighingAreaResult =
  | { kind: 'REACTIVATED'; weighingArea: WeighingArea }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

export type ArchiveWeighingAreasCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type BulkWeighingAreaLifecycleResult = {
  updatedWeighingAreas: WeighingArea[]
  blockedWeighingAreas: BulkWeighingAreaLifecycleBlocker[]
}

export default abstract class WeighingAreaRepository {
  abstract create(command: CreateWeighingAreaCommand): Promise<CreateWeighingAreaResult>

  abstract list(): Promise<WeighingArea[]>

  abstract listAvailable(): Promise<WeighingArea[]>

  abstract findById(id: string): Promise<WeighingArea | null>

  abstract updateAvailable(command: UpdateWeighingAreaCommand): Promise<UpdateWeighingAreaResult>

  abstract archiveAvailable(command: ArchiveWeighingAreaCommand): Promise<ArchiveWeighingAreaResult>

  abstract reactivateArchived(
    command: ReactivateWeighingAreaCommand,
  ): Promise<ReactivateWeighingAreaResult>

  abstract archiveAvailableMany(
    command: ArchiveWeighingAreasCommand,
  ): Promise<BulkWeighingAreaLifecycleResult>
}
