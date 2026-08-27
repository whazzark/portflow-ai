import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import isUniqueViolation from '#shared/database/is_unique_violation'
import isUuid from '#shared/database/is_uuid'
import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { findBulkBlockers } from '#warehouse_doors/shared/warehouse_door_lifecycle_blockers'
import WarehouseDoorRepository, {
  type ArchiveWarehouseDoorCommand,
  type ArchiveWarehouseDoorResult,
  type ArchiveWarehouseDoorsCommand,
  type BulkWarehouseDoorLifecycleResult,
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

@inject()
export default class LucidWarehouseDoorRepository extends WarehouseDoorRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

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

  /**
   * Archives one available door of one available warehouse, on its own.
   *
   * The lock order is **warehouse then door**, the order `create` and `updateAvailable` above take
   * and the one #210's cascade takes when it archives a warehouse together with its doors. Any
   * other order would deadlock against that cascade; this one makes the two queue instead, so a
   * door caught by both ends up archived exactly once, under one context, with the loser answering
   * `ALREADY_ARCHIVED` rather than overwriting what the winner recorded.
   *
   * `archivedWithWarehouse` is written `false` rather than left to the column default. The flag
   * describes *the archival that is current*, not the row's history — a door archived by a cascade
   * and later reactivated carries a cleared flag — and stating it here is what keeps a warehouse
   * reactivation (#211) from restoring a door that was retired on its own.
   */
  async archiveAvailable(
    command: ArchiveWarehouseDoorCommand,
  ): Promise<ArchiveWarehouseDoorResult> {
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

    const archivedAt = command.archivedAt.toSQL({ includeOffset: false })

    const outcome = await WarehouseDoor.transaction<ArchiveWarehouseDoorResult>(async (trx) => {
      const warehouse = await Warehouse.query({ client: trx })
        .where('id', door.warehouseId)
        .where('status', 'AVAILABLE')
        .forUpdate()
        .first()

      if (!warehouse) {
        return { kind: 'WAREHOUSE_ARCHIVED' }
      }

      // The door is locked before the usage read, so a concurrent archival is settled first and
      // the eligibility this write acts on is the one the write lands in.
      //
      // The lock does not close every race: usage lives in
      // `warehouse_door_product_lot_assignments`, and a row lock on the door does not block an
      // INSERT there. Closing that one needs the assignment writer to take the same door lock
      // before inserting. No such writer exists yet — only seeders — so this is an obligation on
      // whoever adds one rather than a live defect, exactly as
      // `LucidWarehouseRepository.findWarehousesWithDoorsInUse` already records.
      await WarehouseDoor.query({ client: trx }).where('id', command.id).forUpdate().first()

      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'WAREHOUSE_DOOR',
        referenceIds: [command.id],
        client: trx,
      })

      if (usedIds.has(command.id)) {
        return { kind: 'IN_USE' }
      }

      const [affectedRows] = await WarehouseDoor.query({ client: trx })
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update({
          status: 'ARCHIVED',
          archivedAt,
          archivedByUserId: command.archivedByUserId,
          archiveComment: command.archiveComment,
          archivedWithWarehouse: false,
          // A query-builder update bypasses Lucid's timestamp hooks, so the transition would
          // otherwise never be recorded.
          updatedAt: archivedAt,
        })

      return affectedRows === 0 ? { kind: 'ALREADY_ARCHIVED' } : { kind: 'ARCHIVED', door }
    })

    if (outcome.kind === 'WAREHOUSE_ARCHIVED') {
      // The guarded read excluded the warehouse either because it is gone or because it is
      // archived; only a second read can say which, and the distinction is what lets an archived
      // warehouse answer with the "reactivate it first" guidance instead of a bare 404. Read again
      // rather than assumed: a warehouse reactivated between the two reads is reported as not
      // found, because guidance the administrator cannot act on is worse than a retry.
      const warehouse = await Warehouse.find(door.warehouseId)

      return !warehouse || warehouse.status === 'AVAILABLE'
        ? { kind: 'WAREHOUSE_NOT_FOUND' }
        : { kind: 'WAREHOUSE_ARCHIVED' }
    }

    if (outcome.kind === 'ALREADY_ARCHIVED') {
      // Same reasoning one level down: the guarded write matched nothing because the door is
      // archived or has since been deleted.
      const current = await WarehouseDoor.find(command.id)

      return current ? { kind: 'ALREADY_ARCHIVED' } : { kind: 'DOOR_NOT_FOUND' }
    }

    if (outcome.kind !== 'ARCHIVED') {
      return outcome
    }

    // Re-read rather than returning the pre-read instance: the caller serializes the stored row,
    // including the archive context this write just recorded.
    const archived = await WarehouseDoor.find(command.id)

    return archived ? { kind: 'ARCHIVED', door: archived } : { kind: 'DOOR_NOT_FOUND' }
  }

  /**
   * Archives every eligible door of a submission in one transaction, and leaves the rest untouched.
   *
   * The lock order is the same as the single path's — **warehouses first, then doors** — and both
   * sets are locked ordered by id, so two overlapping submissions queue instead of deadlocking, and
   * neither can deadlock against #210's cascade. The doors' warehouses are learned by an unlocked
   * pre-read, safe because containment is permanent.
   *
   * That warehouse read is guarded on `AVAILABLE`, exactly as the single path's is: a door may only
   * be archived while its own warehouse is available, and a warehouse that fails the guard is left
   * unlocked precisely because no door of it will be written. Postgres re-checks the predicate after
   * the lock is granted, so a cascade that commits while this submission waits drops the warehouse
   * out of the set rather than letting its doors through.
   *
   * Doors of different warehouses may be submitted together: each answers for its own containing
   * warehouse (`research.md` R12). The interface only ever builds a selection within one warehouse,
   * but that is a property of the Doors panel, not a rule of the domain.
   *
   * The affected-row guard makes the write all-or-nothing: if the count disagrees with the eligible
   * set, a concurrent writer slipped in between the blocker computation and the update, and the
   * whole submission rolls back rather than archiving a subset silently.
   */
  archiveAvailableMany(
    command: ArchiveWarehouseDoorsCommand,
  ): Promise<BulkWarehouseDoorLifecycleResult> {
    return WarehouseDoor.transaction(async (trx) => {
      const submitted = await WarehouseDoor.query({ client: trx }).whereIn('id', command.ids)
      const warehouseIds = [...new Set(submitted.map((door) => door.warehouseId))].sort()

      const availableWarehouses = await Warehouse.query({ client: trx })
        .whereIn('id', warehouseIds)
        .where('status', 'AVAILABLE')
        .orderBy('id')
        .forUpdate()
      const availableWarehouseIds = new Set(availableWarehouses.map((entry) => entry.id))

      // Re-read under lock: the pre-read above only learned which warehouses to lock, and a
      // cascade could have archived any of these doors in between.
      const doors = await WarehouseDoor.query({ client: trx })
        .whereIn('id', command.ids)
        .orderBy('id')
        .forUpdate()
      const doorsById = indexById(doors)
      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'WAREHOUSE_DOOR',
        referenceIds: command.ids,
        client: trx,
      })
      const blockers = findBulkBlockers(
        command.ids,
        doorsById,
        'AVAILABLE',
        availableWarehouseIds,
        usedIds,
      )

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))
      const archivedAt = command.archivedAt.toSQL({ includeOffset: false })

      if (eligibleIds.length > 0) {
        const [affectedRows] = await WarehouseDoor.query({ client: trx })
          .whereIn('id', eligibleIds)
          .where('status', 'AVAILABLE')
          .update({
            status: 'ARCHIVED',
            archivedAt,
            archivedByUserId: command.archivedByUserId,
            archiveComment: command.archiveComment,
            archivedWithWarehouse: false,
            updatedAt: archivedAt,
          })

        if (affectedRows !== eligibleIds.length) {
          throw new Error('Warehouse door bulk archive changed during transaction')
        }
      }

      const archived = await WarehouseDoor.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedDoors: orderByIds(eligibleIds, indexById(archived)),
        blockedDoors: blockers,
      }
    })
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
