import type { DateTime } from 'luxon'
import type Warehouse from '#models/warehouse'
import type { BulkWarehouseLifecycleBlocker } from '#warehouses/shared/warehouse_lifecycle_blockers'

export type { BulkWarehouseLifecycleBlocker } from '#warehouses/shared/warehouse_lifecycle_blockers'

export type ArchiveWarehouseCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type ArchiveWarehousesCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

/**
 * `archivedDoorCount` reports how many doors the cascade wrote, which is every door of the
 * warehouse: one already archived on its own is counted too, because the cascade rewrites its
 * context with the building's rather than skipping it (`applyArchival`). Counting the write at
 * submission time is what lets the caller describe what happened rather than echo the count the
 * client was shown before submitting.
 *
 * `IN_USE` is a repository outcome and not only a use-case exception: the conditional write can
 * lose a race after the use case's pre-check, and the transaction is the only place that sees it.
 */
export type ArchiveWarehouseResult =
  | { kind: 'ARCHIVED'; warehouse: Warehouse; archivedDoorCount: number }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'IN_USE' }

export type ReactivateWarehouseCommand = {
  id: string
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

export type ReactivateWarehousesCommand = {
  ids: string[]
  reactivatedAt: DateTime
  reactivatedByUserId: string
  reactivationComment: string | null
}

/**
 * `reactivatedDoorCount` mirrors `archivedDoorCount`: it reports how many doors the restore
 * actually brought back at submission time, which need not equal the advisory count the
 * confirmation showed.
 *
 * There is no `IN_USE` arm. Archival carries one because its conditional write can lose a race the
 * use case's pre-check passed; an archived warehouse holds no door in a planned or active
 * discharge by construction, so the restore has no usage condition to lose a race on.
 */
export type ReactivateWarehouseResult =
  | { kind: 'REACTIVATED'; warehouse: Warehouse; reactivatedDoorCount: number }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_AVAILABLE' }

export type BulkWarehouseLifecycleResult = {
  updatedWarehouses: Warehouse[]
  blockedWarehouses: BulkWarehouseLifecycleBlocker[]
}

export type WarehouseFootprintPointCommand = { latitude: number; longitude: number }

export type CreateWarehouseCommand = {
  name: string
  points: WarehouseFootprintPointCommand[]
}

export type CreateWarehouseResult =
  | { kind: 'CREATED'; warehouse: Warehouse }
  | { kind: 'DUPLICATE_NAME' }

export type WarehouseDoorPosition = { name: string; latitude: number; longitude: number }

export type UpdateWarehouseCommand = {
  id: string
  name?: string
  /** The complete resulting ring when a footprint was submitted; absent leaves the stored one. */
  points?: WarehouseFootprintPointCommand[]
  /**
   * Names the doors the submitted ring would leave outside. The caller keeps the geometry; the
   * repository only calls this inside the write transaction, against the doors as they stand there,
   * so a door created or moved since the pre-flight read cannot slip outside the stored footprint.
   */
  excludedDoors?: (doors: WarehouseDoorPosition[]) => string[]
}

export type UpdateWarehouseResult =
  | { kind: 'UPDATED'; warehouse: Warehouse }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ARCHIVED' }
  | { kind: 'DUPLICATE_NAME' }
  | { kind: 'DOORS_OUTSIDE'; doorNames: string[] }

export default abstract class WarehouseRepository {
  abstract create(command: CreateWarehouseCommand): Promise<CreateWarehouseResult>

  /** Loads the warehouse with the doors an update has to shape around, or null when it is gone. */
  abstract findWithDoors(id: string): Promise<Warehouse | null>

  abstract updateAvailable(command: UpdateWarehouseCommand): Promise<UpdateWarehouseResult>

  abstract list(): Promise<Warehouse[]>

  abstract archiveAvailable(command: ArchiveWarehouseCommand): Promise<ArchiveWarehouseResult>

  abstract archiveAvailableMany(
    command: ArchiveWarehousesCommand,
  ): Promise<BulkWarehouseLifecycleResult>

  abstract reactivateArchived(
    command: ReactivateWarehouseCommand,
  ): Promise<ReactivateWarehouseResult>

  abstract reactivateArchivedMany(
    command: ReactivateWarehousesCommand,
  ): Promise<BulkWarehouseLifecycleResult>
}
