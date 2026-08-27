import type { DateTime } from 'luxon'
import type WarehouseDoor from '#models/warehouse_door'

export type WarehouseFootprintPoint = { latitude: number; longitude: number }

export type CreateWarehouseDoorCommand = {
  warehouseId: string
  name: string
  latitude: number
  longitude: number
  /**
   * Decides whether the submitted position lies inside the containing footprint. The caller keeps
   * the geometry; the repository only calls this inside the write transaction, against the ring it
   * read under lock — so a footprint replaced since a pre-flight read cannot let a door land
   * outside its own warehouse. Same shape as `UpdateWarehouseCommand.excludedDoors`.
   */
  contains: (points: WarehouseFootprintPoint[]) => boolean
}

/**
 * `WAREHOUSE_NOT_FOUND` and `WAREHOUSE_ARCHIVED` are repository outcomes rather than pre-checks: the
 * guarded read can lose a race against an archival, and the transaction is the only place that sees
 * it. `DUPLICATE_NAME` likewise comes from the `(warehouse_id, LOWER(name))` unique index rather
 * than from a read, which is what makes two simultaneous submissions of one name resolve to exactly
 * one door.
 */
export type CreateWarehouseDoorResult =
  | { kind: 'CREATED'; door: WarehouseDoor }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
  | { kind: 'WAREHOUSE_ARCHIVED' }
  | { kind: 'OUTSIDE_FOOTPRINT' }
  | { kind: 'DUPLICATE_NAME' }

export type UpdateWarehouseDoorCommand = {
  id: string
  /** Absent leaves the stored name; present, it is already trimmed by the use case. */
  name?: string
  /** Latitude and longitude always travel together: a position is replaced as a whole. */
  latitude?: number
  longitude?: number
  /**
   * Decides whether the submitted position lies inside the containing footprint, exactly as
   * `CreateWarehouseDoorCommand.contains` does. **Absent on a name-only update**: a stored door is
   * already inside its warehouse, and #209 refuses any reshape that would leave it outside, so
   * there is no reachable state a rename could have to answer for.
   */
  contains?: (points: WarehouseFootprintPoint[]) => boolean
}

/**
 * Every arm but `UPDATED` is a repository outcome rather than a pre-check: the guarded warehouse
 * read and the guarded door write can each lose a race against an archival, and the transaction is
 * the only place that sees it. `DUPLICATE_NAME` likewise comes from the
 * `(warehouse_id, LOWER(name))` unique index rather than from a read — which is both what makes two
 * simultaneous claims of one name resolve to exactly one winner, and what lets a door resubmit its
 * own name, or a different casing of it, with no self-exclusion clause.
 */
export type UpdateWarehouseDoorResult =
  | { kind: 'UPDATED'; door: WarehouseDoor }
  | { kind: 'DOOR_NOT_FOUND' }
  | { kind: 'DOOR_ARCHIVED' }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
  | { kind: 'WAREHOUSE_ARCHIVED' }
  | { kind: 'OUTSIDE_FOOTPRINT' }
  | { kind: 'DUPLICATE_NAME' }

export type ArchiveWarehouseDoorCommand = {
  id: string
  archivedAt: DateTime
  archivedByUserId: string
  /** Already trimmed by the use case; a blank comment arrives as `null`, never as an empty string. */
  archiveComment: string | null
}

/**
 * Every arm but `ARCHIVED` is a transactional outcome rather than a pre-check, for the reason
 * `updateAvailable` above already gives — and here it decides more than a message. A door archival
 * races #210's cascade, which archives every available door of a warehouse in one transaction. A
 * status read taken before the write could be stale by the time it lands, and the loser would
 * archive the door a second time, overwriting the time, actor, comment, and provenance a later
 * warehouse reactivation (#211) depends on. So the guarded `status = 'AVAILABLE'` write inside the
 * transaction is the only thing that decides `ALREADY_ARCHIVED`, and it decides it exactly once.
 */
export type ArchiveWarehouseDoorResult =
  | { kind: 'ARCHIVED'; door: WarehouseDoor }
  | { kind: 'DOOR_NOT_FOUND' }
  | { kind: 'ALREADY_ARCHIVED' }
  | { kind: 'IN_USE' }
  | { kind: 'WAREHOUSE_NOT_FOUND' }
  | { kind: 'WAREHOUSE_ARCHIVED' }

export type ArchiveWarehouseDoorsCommand = {
  ids: string[]
  archivedAt: DateTime
  archivedByUserId: string
  archiveComment: string | null
}

export type BulkWarehouseDoorLifecycleBlocker = {
  id: string
  /** The door's own name, so an outcome can identify it. Absent for `NOT_FOUND`: no row to name. */
  name?: string
  /** `WAREHOUSE_ARCHIVED` is the bulk counterpart of the single path's refusal of the same name:
   * an available door under an archived warehouse, which only a crafted submission can name. */
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' | 'WAREHOUSE_ARCHIVED'
}

export type BulkWarehouseDoorLifecycleResult = {
  /** In submission order, so the outcome reads the way the administrator built the selection. */
  updatedDoors: WarehouseDoor[]
  blockedDoors: BulkWarehouseDoorLifecycleBlocker[]
}

export default abstract class WarehouseDoorRepository {
  abstract create(command: CreateWarehouseDoorCommand): Promise<CreateWarehouseDoorResult>

  abstract updateAvailable(command: UpdateWarehouseDoorCommand): Promise<UpdateWarehouseDoorResult>

  abstract archiveAvailable(
    command: ArchiveWarehouseDoorCommand,
  ): Promise<ArchiveWarehouseDoorResult>

  abstract archiveAvailableMany(
    command: ArchiveWarehouseDoorsCommand,
  ): Promise<BulkWarehouseDoorLifecycleResult>

  abstract listAvailable(): Promise<WarehouseDoor[]>
}
