import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

import Warehouse from '#models/warehouse'
import WarehouseDoor from '#models/warehouse_door'
import WarehouseFootprintPoint from '#models/warehouse_footprint_point'
import isUniqueViolation from '#shared/database/is_unique_violation'
import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { findBulkBlockers } from '#warehouses/shared/warehouse_lifecycle_blockers'

import WarehouseRepository, {
  type ArchiveWarehouseCommand,
  type ArchiveWarehouseResult,
  type ArchiveWarehousesCommand,
  type BulkWarehouseLifecycleResult,
  type CreateWarehouseCommand,
  type CreateWarehouseResult,
  type ReactivateWarehouseCommand,
  type ReactivateWarehouseResult,
  type ReactivateWarehousesCommand,
} from './warehouse_repository.ts'

type WarehouseQuery = ModelQueryBuilderContract<typeof Warehouse, Warehouse>

const withRelations = <Query extends WarehouseQuery>(query: Query): Query =>
  query
    .preload('footprintPoints', (points) => points.orderBy('position', 'asc'))
    .preload('doors', (doors) =>
      doors.orderByRaw('LOWER(name) ASC').orderBy('name', 'asc').orderBy('id', 'asc'),
    ) as Query

@inject()
export default class LucidWarehouseRepository extends WarehouseRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

  async create(command: CreateWarehouseCommand): Promise<CreateWarehouseResult> {
    try {
      const warehouse = await Warehouse.transaction(async (trx) => {
        const created = await Warehouse.create(
          { name: command.name, status: 'AVAILABLE' },
          { client: trx },
        )

        // `position` comes from the submitted order, which is the drawn order: it is what makes the
        // stored ring reproduce the outline the administrator drew.
        await WarehouseFootprintPoint.createMany(
          command.points.map((point, position) => ({
            warehouseId: created.id,
            position,
            latitude: point.latitude,
            longitude: point.longitude,
          })),
          { client: trx },
        )

        return created
      })

      // The transformer reads `footprintPoints` and `doors` and rejects a footprint under three
      // points, so a freshly created instance must be reloaded before it can be serialized.
      await warehouse.load('footprintPoints', (query) => query.orderBy('position', 'asc'))
      await warehouse.load('doors')

      return { kind: 'CREATED', warehouse }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  list(): Promise<Warehouse[]> {
    return withRelations(Warehouse.query())
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  /**
   * Archives a warehouse and cascades onto its available doors in one transaction.
   *
   * Unlike the delivered single-archive paths for the other site references, the in-use check runs
   * here rather than in the use case. Those references do not cascade, so a lost race only fails to
   * archive them; a warehouse cascade that lost the same race would archive a door a planned or
   * active discharge still holds — exactly what this feature must never do. Checking inside the
   * transaction that performs the write is what makes "assessed at submission time" (spec FR-008)
   * true against concurrent archivals; `findWarehousesWithDoorsInUse` records what it does not
   * cover.
   */
  archiveAvailable(command: ArchiveWarehouseCommand): Promise<ArchiveWarehouseResult> {
    return Warehouse.transaction(async (trx) => {
      const warehouses = await this.lockWarehouses(trx, [command.id])
      const warehouse = warehouses.at(0)

      if (!warehouse) {
        return { kind: 'NOT_FOUND' }
      }

      if (warehouse.status !== 'AVAILABLE') {
        return { kind: 'ALREADY_ARCHIVED' }
      }

      const usedWarehouseIds = await this.findWarehousesWithDoorsInUse(trx, [command.id])

      if (usedWarehouseIds.has(command.id)) {
        return { kind: 'IN_USE' }
      }

      const archivedDoorCount = await this.applyArchival(trx, [command.id], command)
      const archived = await withRelations(
        Warehouse.query({ client: trx }).where('id', command.id),
      ).first()

      return archived
        ? { kind: 'ARCHIVED', warehouse: archived, archivedDoorCount }
        : { kind: 'NOT_FOUND' }
    })
  }

  archiveAvailableMany(command: ArchiveWarehousesCommand): Promise<BulkWarehouseLifecycleResult> {
    return Warehouse.transaction(async (trx) => {
      const warehouses = await this.lockWarehouses(trx, command.ids)
      const warehousesById = indexById(warehouses)
      const usedWarehouseIds = await this.findWarehousesWithDoorsInUse(trx, command.ids)
      const blockers = findBulkBlockers(command.ids, warehousesById, 'AVAILABLE', usedWarehouseIds)

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      await this.applyArchival(trx, eligibleIds, command)

      const archived = await withRelations(
        Warehouse.query({ client: trx }).whereIn('id', eligibleIds),
      )

      return {
        updatedWarehouses: orderByIds(eligibleIds, indexById(archived)),
        blockedWarehouses: blockers,
      }
    })
  }

  /**
   * Reactivates an archived warehouse and restores the doors archived with it, in one transaction.
   *
   * Warehouses are locked before any door is written, the same order `archiveAvailable` takes, so a
   * concurrent archival and reactivation of the same warehouse queue instead of deadlocking. There
   * is no usage query on this path: an archived warehouse holds no door in a planned or active
   * discharge by construction, so `IN_USE` cannot arise and doors need no `FOR UPDATE` scan.
   */
  reactivateArchived(command: ReactivateWarehouseCommand): Promise<ReactivateWarehouseResult> {
    return Warehouse.transaction(async (trx) => {
      const warehouses = await this.lockWarehouses(trx, [command.id])
      const warehouse = warehouses.at(0)

      if (!warehouse) {
        return { kind: 'NOT_FOUND' }
      }

      if (warehouse.status !== 'ARCHIVED') {
        return { kind: 'ALREADY_AVAILABLE' }
      }

      const reactivatedDoorCount = await this.applyReactivation(trx, [command.id], command)
      const reactivated = await withRelations(
        Warehouse.query({ client: trx }).where('id', command.id),
      ).first()

      return reactivated
        ? { kind: 'REACTIVATED', warehouse: reactivated, reactivatedDoorCount }
        : { kind: 'NOT_FOUND' }
    })
  }

  reactivateArchivedMany(
    command: ReactivateWarehousesCommand,
  ): Promise<BulkWarehouseLifecycleResult> {
    return Warehouse.transaction(async (trx) => {
      const warehouses = await this.lockWarehouses(trx, command.ids)
      const warehousesById = indexById(warehouses)
      // No `usedIds`: reactivation has no usage blocker, so the reason set is exactly
      // `NOT_FOUND` and `ALREADY_AVAILABLE`.
      const blockers = findBulkBlockers(command.ids, warehousesById, 'ARCHIVED')

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      await this.applyReactivation(trx, eligibleIds, command)

      const reactivated = await withRelations(
        Warehouse.query({ client: trx }).whereIn('id', eligibleIds),
      )

      return {
        updatedWarehouses: orderByIds(eligibleIds, indexById(reactivated)),
        blockedWarehouses: blockers,
      }
    })
  }

  /**
   * Locked by id so concurrent submissions over overlapping sets always take the warehouse row
   * locks in the same order and can never deadlock each other. Doors are locked in
   * `findWarehousesWithDoorsInUse`, always after the warehouses — the table order is fixed too.
   */
  private lockWarehouses(trx: TransactionClientContract, ids: string[]) {
    return Warehouse.query({ client: trx }).whereIn('id', ids).orderBy('id').forUpdate()
  }

  /**
   * A warehouse has no discharge relationship of its own; it serves operations exclusively through
   * its doors. So usage is the shared warehouse-door rule (`#240` FR-006) projected back onto the
   * containing warehouse, assessed set-based over every candidate door rather than per warehouse.
   *
   * The `FOR UPDATE` on the doors serializes this against a concurrent archival, but not against a
   * discharge being planned: usage lives in `warehouse_door_product_lot_assignments`, and a row lock
   * on the door does not block an INSERT into that table. Closing that race needs the assignment
   * writer to take the same door lock before inserting. No such writer exists yet — only seeders —
   * so this is an obligation on whoever adds one rather than a live defect.
   */
  private async findWarehousesWithDoorsInUse(trx: TransactionClientContract, ids: string[]) {
    const doors = await WarehouseDoor.query({ client: trx })
      .whereIn('warehouseId', ids)
      .orderBy('id')
      .forUpdate()
    const warehouseIdByDoorId = new Map(doors.map((door) => [door.id, door.warehouseId]))

    if (warehouseIdByDoorId.size === 0) {
      return new Set<string>()
    }

    const usedDoorIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
      referenceType: 'WAREHOUSE_DOOR',
      referenceIds: [...warehouseIdByDoorId.keys()],
      client: trx,
    })

    return new Set(
      [...usedDoorIds].flatMap((doorId) => {
        const warehouseId = warehouseIdByDoorId.get(doorId)

        return warehouseId ? [warehouseId] : []
      }),
    )
  }

  /**
   * Both writes share one timestamp, actor, and comment, and the affected-row guard makes the pair
   * all-or-nothing: a warehouse can never end up archived while one of its available doors stays
   * available (spec FR-027). Returns how many doors the cascade archived.
   */
  private async applyArchival(
    trx: TransactionClientContract,
    eligibleIds: string[],
    command: ArchiveWarehouseCommand | ArchiveWarehousesCommand,
  ) {
    if (eligibleIds.length === 0) {
      return 0
    }

    const archivedAt = command.archivedAt.toSQL({ includeOffset: false })
    const [affectedWarehouses] = await Warehouse.query({ client: trx })
      .whereIn('id', eligibleIds)
      .where('status', 'AVAILABLE')
      .update({
        status: 'ARCHIVED',
        archivedAt,
        archivedByUserId: command.archivedByUserId,
        archiveComment: command.archiveComment,
        updatedAt: archivedAt,
      })

    if (affectedWarehouses !== eligibleIds.length) {
      throw new Error('Warehouse archive changed during transaction')
    }

    const [affectedDoors] = await WarehouseDoor.query({ client: trx })
      .whereIn('warehouseId', eligibleIds)
      .where('status', 'AVAILABLE')
      .update({
        status: 'ARCHIVED',
        archivedAt,
        archivedByUserId: command.archivedByUserId,
        archiveComment: command.archiveComment,
        archivedWithWarehouse: true,
        updatedAt: archivedAt,
      })

    return affectedDoors
  }

  /**
   * The mirror of `applyArchival`, and the heart of this feature.
   *
   * The door predicate is what separates a door archived *by* this warehouse from one retired on
   * its own: only `archived_with_warehouse = true` comes back. `archived_with_warehouse` is then
   * cleared, or a door archived independently after this restore would be dragged back by the next
   * one — the marker has to describe the door's current archival, not a past one.
   *
   * Neither update touches an `archived_*` column: the archive context is what makes the period
   * spent archived consultable afterwards.
   *
   * The affected-row guard is asymmetric on purpose, exactly as archival's is. The eligible
   * warehouse count is known before the write, so a mismatch proves a concurrent writer slipped in
   * and the transaction must abort. How many doors carry the marker is only discoverable by the
   * update itself, so there is no expected value to compare against — it is returned instead.
   */
  private async applyReactivation(
    trx: TransactionClientContract,
    eligibleIds: string[],
    command: ReactivateWarehouseCommand | ReactivateWarehousesCommand,
  ) {
    if (eligibleIds.length === 0) {
      return 0
    }

    const reactivatedAt = command.reactivatedAt.toSQL({ includeOffset: false })
    const [affectedWarehouses] = await Warehouse.query({ client: trx })
      .whereIn('id', eligibleIds)
      .where('status', 'ARCHIVED')
      .update({
        status: 'AVAILABLE',
        reactivatedAt,
        reactivatedByUserId: command.reactivatedByUserId,
        reactivationComment: command.reactivationComment,
        updatedAt: reactivatedAt,
      })

    if (affectedWarehouses !== eligibleIds.length) {
      throw new Error('Warehouse reactivation changed during transaction')
    }

    const [affectedDoors] = await WarehouseDoor.query({ client: trx })
      .whereIn('warehouseId', eligibleIds)
      .where('status', 'ARCHIVED')
      .where('archivedWithWarehouse', true)
      .update({
        status: 'AVAILABLE',
        archivedWithWarehouse: false,
        reactivatedAt,
        reactivatedByUserId: command.reactivatedByUserId,
        reactivationComment: command.reactivationComment,
        updatedAt: reactivatedAt,
      })

    return affectedDoors
  }
}
