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

export default abstract class WarehouseDoorRepository {
  abstract create(command: CreateWarehouseDoorCommand): Promise<CreateWarehouseDoorResult>

  abstract listAvailable(): Promise<WarehouseDoor[]>
}
