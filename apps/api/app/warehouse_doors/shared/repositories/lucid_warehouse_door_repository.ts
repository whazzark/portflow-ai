import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import isUniqueViolation from '#shared/database/is_unique_violation'
import isUuid from '#shared/database/is_uuid'
import WarehouseDoorRepository, {
  type CreateWarehouseDoorCommand,
  type CreateWarehouseDoorResult,
} from './warehouse_door_repository.ts'

/**
 * Rolls the insert back when the locked footprint does not contain the submitted position. It never
 * escapes the repository: `create` turns it into an `OUTSIDE_FOOTPRINT` result.
 */
class OutsideFootprint extends Error {
  constructor() {
    super('Warehouse door falls outside its warehouse footprint')
  }
}

export default class LucidWarehouseDoorRepository extends WarehouseDoorRepository {
  async create(command: CreateWarehouseDoorCommand): Promise<CreateWarehouseDoorResult> {
    // An identifier that cannot name a row is simply not found: without this the `uuid` column makes
    // Postgres raise `22P02`, turning a malformed id into a 500 instead of a 404.
    if (!isUuid(command.warehouseId)) {
      return { kind: 'WAREHOUSE_NOT_FOUND' }
    }

    try {
      const door = await WarehouseDoor.transaction(async (trx) => {
        // Locked before anything is read off it, so an archival (#210) or a footprint replacement
        // (#209) committing in parallel is fully settled before this transaction sees the warehouse.
        // Both the eligibility and the containment rules are then checked against the same snapshot
        // the insert lands in, rather than against a pre-flight read either could have invalidated.
        const warehouse = await Warehouse.query({ client: trx })
          .where('id', command.warehouseId)
          .where('status', 'AVAILABLE')
          .forUpdate()
          .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
          .first()

        if (!warehouse) {
          return null
        }

        if (!command.contains(warehouse.footprintPoints)) {
          throw new OutsideFootprint()
        }

        return WarehouseDoor.create(
          {
            warehouseId: command.warehouseId,
            name: command.name,
            latitude: command.latitude,
            longitude: command.longitude,
            status: 'AVAILABLE',
            archivedAt: null,
            archivedByUserId: null,
            archiveComment: null,
            archivedWithWarehouse: false,
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
          },
          { client: trx },
        )
      })

      if (!door) {
        // The guarded read excluded the warehouse either because it is gone or because it is
        // archived; only a second read can say which, and the distinction is what lets an archived
        // warehouse answer with the "reactivate it first" guidance instead of a bare 404.
        const warehouse = await Warehouse.find(command.warehouseId)

        return warehouse ? { kind: 'WAREHOUSE_ARCHIVED' } : { kind: 'WAREHOUSE_NOT_FOUND' }
      }

      return { kind: 'CREATED', door }
    } catch (error) {
      if (error instanceof OutsideFootprint) {
        return { kind: 'OUTSIDE_FOOTPRINT' }
      }

      // The `(warehouse_id, LOWER(name))` index is the arbiter rather than a pre-read, so two
      // simultaneous submissions of one name resolve to exactly one door.
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  listAvailable(): Promise<WarehouseDoor[]> {
    return WarehouseDoor.query()
      .where('status', 'AVAILABLE')
      .whereHas('warehouse', (query) => query.where('status', 'AVAILABLE'))
      .orderBy('warehouse_id', 'asc')
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }
}
