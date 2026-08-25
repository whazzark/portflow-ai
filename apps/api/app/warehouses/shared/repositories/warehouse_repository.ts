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
 * `archivedDoorCount` reports how many doors the cascade actually archived, so the caller can
 * describe what happened rather than echo the count the client was shown before submitting.
 *
 * `IN_USE` is a repository outcome and not only a use-case exception: the conditional write can
 * lose a race after the use case's pre-check, and the transaction is the only place that sees it.
 */
export type ArchiveWarehouseResult =
  | { kind: 'ARCHIVED'; warehouse: Warehouse; archivedDoorCount: number }
  | { kind: 'NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'IN_USE' }

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

export default abstract class WarehouseRepository {
  abstract create(command: CreateWarehouseCommand): Promise<CreateWarehouseResult>

  abstract list(): Promise<Warehouse[]>

  abstract archiveAvailable(command: ArchiveWarehouseCommand): Promise<ArchiveWarehouseResult>

  abstract archiveAvailableMany(
    command: ArchiveWarehousesCommand,
  ): Promise<BulkWarehouseLifecycleResult>
}
