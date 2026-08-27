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

export default abstract class WarehouseDoorRepository {
  abstract create(command: CreateWarehouseDoorCommand): Promise<CreateWarehouseDoorResult>

  abstract updateAvailable(command: UpdateWarehouseDoorCommand): Promise<UpdateWarehouseDoorResult>

  abstract listAvailable(): Promise<WarehouseDoor[]>
}
