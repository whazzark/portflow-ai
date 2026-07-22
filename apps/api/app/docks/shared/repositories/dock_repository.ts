import type { DateTime } from 'luxon'

import type Dock from '#models/dock'

export type CreateDockCommand = {
  name: string
  latitude: number
  longitude: number
}

export type UpdateDockCommand = {
  id: string
  name?: string
  latitude?: number
  longitude?: number
}

export type ArchiveDockCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ReactivateDockCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type DockWriteResult =
  | { kind: 'CREATED'; dock: Dock }
  | { kind: 'UPDATED'; dock: Dock }
  | { kind: 'DUPLICATE_NAME' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }

export type ArchiveDockResult =
  | { kind: 'ARCHIVED'; dock: Dock }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }

export type ReactivateDockResult =
  | { kind: 'REACTIVATED'; dock: Dock }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

export default abstract class DockRepository {
  abstract create(command: CreateDockCommand): Promise<DockWriteResult>
  abstract list(): Promise<Dock[]>
  abstract listAvailable(): Promise<Dock[]>
  abstract findById(id: string): Promise<Dock | null>
  abstract updateAvailable(command: UpdateDockCommand): Promise<DockWriteResult>
  abstract archiveAvailable(command: ArchiveDockCommand): Promise<ArchiveDockResult>
  abstract reactivateArchived(command: ReactivateDockCommand): Promise<ReactivateDockResult>
}
