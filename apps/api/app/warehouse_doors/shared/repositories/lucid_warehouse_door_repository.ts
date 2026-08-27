import { DateTime } from 'luxon'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import isUniqueViolation from '#shared/database/is_unique_violation'
import isUuid from '#shared/database/is_uuid'
import WarehouseDoorRepository, {
  type CreateWarehouseDoorCommand,
  type CreateWarehouseDoorResult,
  type UpdateWarehouseDoorCommand,
  type UpdateWarehouseDoorResult,
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
        // warehouse answer with the "reactivate it first" guidance instead of a bare 404. The
        // status is read again rather than assumed: a warehouse reactivated between the two reads
        // is reported as not found, because "reactivate it first" would be guidance the
        // administrator cannot act on, whereas a retry resolves it.
        const warehouse = await Warehouse.find(command.warehouseId)

        if (!warehouse || warehouse.status === 'AVAILABLE') {
          return { kind: 'WAREHOUSE_NOT_FOUND' }
        }

        return { kind: 'WAREHOUSE_ARCHIVED' }
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

  async updateAvailable(command: UpdateWarehouseDoorCommand): Promise<UpdateWarehouseDoorResult> {
    // An identifier that cannot name a row is simply not found: without this the `uuid` column makes
    // Postgres raise `22P02`, turning a malformed id into a 500 instead of a 404.
    if (!isUuid(command.id)) {
      return { kind: 'DOOR_NOT_FOUND' }
    }

    // Unlocked, and before the transaction opens, purely to learn which warehouse to lock. Safe
    // because containment is permanent (`CONTEXT.md`): the id it yields cannot go stale, and every
    // decision that depends on it is taken again below, under lock.
    const door = await WarehouseDoor.find(command.id)

    if (!door) {
      return { kind: 'DOOR_NOT_FOUND' }
    }

    try {
      const outcome = await WarehouseDoor.transaction<UpdateWarehouseDoorResult>(async (trx) => {
        // The warehouse is locked first — the order `create` above and #210's archival cascade both
        // take, so this write can never deadlock against them. It also settles a parallel archival
        // (#210) or footprint replacement (#209) before this transaction reads either, so
        // eligibility and containment are checked against the snapshot the update lands in.
        const warehouse = await Warehouse.query({ client: trx })
          .where('id', door.warehouseId)
          .where('status', 'AVAILABLE')
          .forUpdate()
          .preload('footprintPoints', (query) => query.orderBy('position', 'asc'))
          .first()

        if (!warehouse) {
          return { kind: 'WAREHOUSE_ARCHIVED' }
        }

        // Absent on a name-only update: a stored door is already inside its warehouse, and #209
        // refuses any reshape that would leave it outside.
        if (command.contains && !command.contains(warehouse.footprintPoints)) {
          return { kind: 'OUTSIDE_FOOTPRINT' }
        }

        const [affectedRows] = await WarehouseDoor.query({ client: trx })
          .where('id', command.id)
          .where('status', 'AVAILABLE')
          .update({
            ...(command.name === undefined ? {} : { name: command.name }),
            ...(command.latitude === undefined ? {} : { latitude: command.latitude }),
            ...(command.longitude === undefined ? {} : { longitude: command.longitude }),
            // A query-builder update bypasses Lucid's timestamp hooks, so the correction would
            // otherwise never be recorded.
            updatedAt: DateTime.now().toSQL({ includeOffset: false }),
          })

        return affectedRows === 0 ? { kind: 'DOOR_ARCHIVED' } : { kind: 'UPDATED', door }
      })

      if (outcome.kind === 'WAREHOUSE_ARCHIVED') {
        // The guarded read excluded the warehouse either because it is gone or because it is
        // archived; only a second read can say which, and the distinction is what lets an archived
        // warehouse answer with the "reactivate it first" guidance instead of a bare 404. Read
        // again rather than assumed: a warehouse reactivated between the two reads is reported as
        // not found, because guidance the administrator cannot act on is worse than a retry.
        const warehouse = await Warehouse.find(door.warehouseId)

        return !warehouse || warehouse.status === 'AVAILABLE'
          ? { kind: 'WAREHOUSE_NOT_FOUND' }
          : { kind: 'WAREHOUSE_ARCHIVED' }
      }

      if (outcome.kind === 'DOOR_ARCHIVED') {
        // Same reasoning one level down: the guarded write matched nothing because the door is
        // archived or has since been deleted.
        const current = await WarehouseDoor.find(command.id)

        return current ? { kind: 'DOOR_ARCHIVED' } : { kind: 'DOOR_NOT_FOUND' }
      }

      if (outcome.kind !== 'UPDATED') {
        return outcome
      }

      // Re-read rather than returning the pre-read instance: the caller serializes the stored row,
      // including the `updatedAt` this write just advanced.
      const updated = await WarehouseDoor.find(command.id)

      return updated ? { kind: 'UPDATED', door: updated } : { kind: 'DOOR_NOT_FOUND' }
    } catch (error) {
      // The `(warehouse_id, LOWER(name))` index is the arbiter rather than a pre-read, so two
      // simultaneous claims of one name resolve to exactly one winner — and a door resubmitting its
      // own name, or a different casing of it, needs no self-exclusion clause.
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
