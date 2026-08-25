import { inject } from '@adonisjs/core'
import { Decimal } from 'decimal.js'
import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'
import Truck from '#models/truck'
import isUniqueViolation from '#shared/database/is_unique_violation'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import {
  findBulkBlockers,
  indexTrucksById,
  orderTrucks,
} from '#trucks/shared/truck_lifecycle_blockers'

import TruckRepository, {
  type ArchiveTruckCommand,
  type ArchiveTruckResult,
  type ArchiveTrucksCommand,
  type BulkTruckLifecycleResult,
  type CreateTruckCommand,
  type FindCompanyIdsWithAvailableTrucksInput,
  type ReactivateTruckCommand,
  type ReactivateTruckResult,
  type ReactivateTrucksCommand,
  type SuspendTruckCommand,
  type SuspendTruckResult,
  type TruckWriteResult,
  type UpdateTruckCommand,
} from './truck_repository.ts'

function isRegistrationUniqueViolation(error: unknown): boolean {
  if (!isUniqueViolation(error)) {
    return false
  }

  const candidate = error as { constraint?: string; message?: string }
  const marker = `${candidate.constraint ?? ''} ${candidate.message ?? ''}`

  return marker.includes('trucks_registration_unique')
}

@inject()
export default class LucidTruckRepository extends TruckRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

  create(command: CreateTruckCommand): Promise<TruckWriteResult> {
    return Truck.transaction(async (trx) => {
      // Locking the parent company row before inserting closes the race the plain read used to
      // have: archiving a company (LucidTransportCompanyRepository#archiveAvailable) locks this
      // same row before checking for available trucks, so whichever of the two transactions runs
      // first is fully committed before the other observes the company's state.
      const transportCompany = await TransportCompany.query({ client: trx })
        .where('id', command.transportCompanyId)
        .forUpdate()
        .first()

      if (transportCompany?.status !== 'AVAILABLE') {
        return { kind: 'INVALID_TRANSPORT_COMPANY' }
      }

      try {
        const truck = await Truck.create(
          {
            ...command,
            capacityTonnes: new Decimal(command.capacityTonnes),
            status: 'AVAILABLE',
            archivedAt: null,
            archivedByUserId: null,
            archiveComment: null,
            reactivatedAt: null,
            reactivatedByUserId: null,
            reactivationComment: null,
            suspendedAt: null,
            suspendedByUserId: null,
            suspensionComment: null,
          },
          { client: trx },
        )

        return { kind: 'CREATED', truck }
      } catch (error) {
        if (isRegistrationUniqueViolation(error)) {
          return { kind: 'DUPLICATE_REGISTRATION' }
        }

        throw error
      }
    })
  }

  findById(id: string): Promise<Truck | null> {
    return Truck.query()
      .where('id', id)
      .preload('archivedBy')
      .preload('reactivatedBy')
      .preload('suspendedBy')
      .first()
  }

  async updateAvailable(command: UpdateTruckCommand): Promise<TruckWriteResult> {
    try {
      const [affectedRows] = await Truck.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        // Pinning the write to the transport company the caller validated its reassignment
        // decision against turns a concurrent reassignment into a reported conflict instead of a
        // silent revert: without this, a stale "unchanged company" submission would overwrite a
        // company another request just legitimately assigned, bypassing every check that only
        // runs when a change is detected.
        .where('transportCompanyId', command.expectedTransportCompanyId)
        .update({
          registration: command.registration,
          vehicleModel: command.vehicleModel,
          // The bulk query-builder `.update()` bypasses the model's `prepare` column hook, unlike
          // `Truck.create()`, so the Decimal must be stringified explicitly for the sqlite/pg driver.
          capacityTonnes: new Decimal(command.capacityTonnes).toString(),
          transportCompanyId: command.transportCompanyId,
          updatedAt: DateTime.now().toSQL({ includeOffset: false }),
        })

      if (affectedRows === 0) {
        const truck = await Truck.find(command.id)

        if (!truck) {
          return { kind: 'NOT_FOUND' }
        }
        if (truck.status === 'SUSPENDED') {
          return { kind: 'SUSPENDED' }
        }
        if (truck.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }
        if (truck.transportCompanyId !== command.expectedTransportCompanyId) {
          return { kind: 'TRANSPORT_COMPANY_CHANGED' }
        }

        // The row is AVAILABLE now but the UPDATE above matched no rows: it was reactivated
        // concurrently between the UPDATE and this refetch. Treat it like the caller's original
        // read was stale rather than reporting a misleading success.
        return { kind: 'NOT_FOUND' }
      }

      const truck = await Truck.query()
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        .first()
      if (!truck) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'UPDATED', truck }
    } catch (error) {
      if (isRegistrationUniqueViolation(error)) {
        return { kind: 'DUPLICATE_REGISTRATION' }
      }

      throw error
    }
  }

  list(): Promise<Truck[]> {
    return (
      Truck.query()
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
        .orderByRaw('LOWER(registration) ASC')
        .orderBy('registration', 'asc')
        .orderBy('id', 'asc')
    )
  }

  listAvailable(): Promise<Truck[]> {
    return (
      Truck.query()
        .where('status', 'AVAILABLE')
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
        .orderByRaw('LOWER(registration) ASC')
        .orderBy('registration', 'asc')
        .orderBy('id', 'asc')
    )
  }

  /**
   * The suspended collection is read by every active role, not only administrators, so it
   * deliberately preloads no lifecycle actor: `toOperationalView` never exposes one.
   */
  listSuspended(): Promise<Truck[]> {
    return (
      Truck.query()
        .where('status', 'SUSPENDED')
        // biome-ignore lint/security/noSecrets: SQL ordering expression, not a secret
        .orderByRaw('LOWER(registration) ASC')
        .orderBy('registration', 'asc')
        .orderBy('id', 'asc')
    )
  }

  async findCompanyIdsWithAvailableTrucks(
    input: FindCompanyIdsWithAvailableTrucksInput,
  ): Promise<Set<string>> {
    if (input.transportCompanyIds.length === 0) {
      return new Set()
    }

    const rows = await Truck.query({ client: input.client })
      .select('transportCompanyId')
      .whereIn('transportCompanyId', [...input.transportCompanyIds])
      .where('status', 'AVAILABLE')

    return new Set(rows.map((row) => row.transportCompanyId))
  }

  archiveAvailable(command: ArchiveTruckCommand): Promise<ArchiveTruckResult> {
    return Truck.transaction(async (trx) => {
      const truck = await Truck.query({ client: trx }).where('id', command.id).forUpdate().first()

      if (!truck) {
        return { kind: 'NOT_FOUND' }
      }
      if (truck.status === 'ARCHIVED') {
        return { kind: 'ALREADY_ARCHIVED' }
      }
      // Without this branch a suspended truck reaches the unguarded UPDATE below and is archived:
      // archival requires an available truck, and a suspended one has to return to service first.
      if (truck.status === 'SUSPENDED') {
        return { kind: 'SUSPENDED' }
      }

      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'TRUCK',
        referenceIds: [command.id],
        client: trx,
      })

      if (usedIds.has(command.id)) {
        return { kind: 'IN_USE' }
      }

      await Truck.query({ client: trx })
        .where('id', command.id)
        .update({
          status: 'ARCHIVED',
          archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
          archivedByUserId: command.archivedByUserId,
          archiveComment: command.archiveComment,
          updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
        })

      const archived = await Truck.query({ client: trx })
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        .first()

      if (!archived) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'ARCHIVED', truck: archived }
    })
  }

  archiveAvailableMany(command: ArchiveTrucksCommand): Promise<BulkTruckLifecycleResult> {
    return Truck.transaction(async (trx) => {
      const trucks = await Truck.query({ client: trx }).whereIn('id', command.ids).forUpdate()
      const trucksById = indexTrucksById(trucks)
      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'TRUCK',
        referenceIds: command.ids,
        client: trx,
      })
      const blockers = findBulkBlockers(command.ids, trucksById, 'AVAILABLE', usedIds)

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await Truck.query({ client: trx })
        .whereIn('id', eligibleIds)
        .where('status', 'AVAILABLE')
        .update({
          status: 'ARCHIVED',
          archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
          archivedByUserId: command.archivedByUserId,
          archiveComment: command.archiveComment,
          updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
        })

      if (affectedRows !== eligibleIds.length) {
        throw new Error('Truck bulk archive changed during transaction')
      }

      const archived = await Truck.query({ client: trx })
        .whereIn('id', eligibleIds)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')

      return {
        updatedTrucks: orderTrucks(eligibleIds, indexTrucksById(archived)),
        blockedTrucks: blockers,
      }
    })
  }

  reactivateArchived(command: ReactivateTruckCommand): Promise<ReactivateTruckResult> {
    return Truck.transaction(async (trx) => {
      const truck = await Truck.query({ client: trx }).where('id', command.id).forUpdate().first()

      if (!truck) {
        return { kind: 'NOT_FOUND' }
      }
      if (truck.status === 'AVAILABLE') {
        return { kind: 'ALREADY_AVAILABLE' }
      }
      // Reactivation reverses an archival. A suspended truck was never archived, so reactivating
      // it would silently make it available without any return-to-service decision.
      if (truck.status === 'SUSPENDED') {
        return { kind: 'SUSPENDED' }
      }

      // Locked for the same reason `create` and `archiveAvailable` (transport-company side) lock
      // this row: a transport company cannot be archived while it still provides available
      // trucks, and this write is the third path that can produce an available truck. Reading
      // the company under a lock, inside the same transaction as the truck's own lock and write,
      // closes the check-then-act window a plain read would leave against a concurrent company
      // archival. An archived truck's `transportCompanyId` cannot change (`updateAvailable` is
      // guarded by `WHERE status = 'AVAILABLE'`), so the id read from the locked truck row above
      // is authoritative for the rest of this transaction.
      const transportCompany = await TransportCompany.query({ client: trx })
        .where('id', truck.transportCompanyId)
        .forUpdate()
        .first()

      if (transportCompany?.status !== 'AVAILABLE') {
        return { kind: 'TRANSPORT_COMPANY_ARCHIVED' }
      }

      await Truck.query({ client: trx })
        .where('id', command.id)
        .update({
          status: 'AVAILABLE',
          reactivatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
          reactivatedByUserId: command.reactivatedByUserId,
          reactivationComment: command.reactivationComment,
          updatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
        })

      const reactivated = await Truck.query({ client: trx })
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        .first()

      if (!reactivated) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'REACTIVATED', truck: reactivated }
    })
  }

  reactivateArchivedMany(command: ReactivateTrucksCommand): Promise<BulkTruckLifecycleResult> {
    return Truck.transaction(async (trx) => {
      const trucks = await Truck.query({ client: trx })
        .whereIn('id', command.ids)
        .orderBy('id', 'asc')
        .forUpdate()
      const trucksById = indexTrucksById(trucks)

      const archivedCompanyIds = [
        ...new Set(
          trucks
            .filter((truck) => truck.status === 'ARCHIVED')
            .map((truck) => truck.transportCompanyId),
        ),
      ].sort()

      // Locked for the same reason the single-truck path locks the company row: a transport
      // company cannot be archived while it still provides available trucks, and this write can
      // produce several available trucks at once. Sorting both this query and the truck query
      // above by id gives every reactivation (single or bulk) the same lock acquisition order,
      // so overlapping submissions cannot deadlock against each other.
      const companies =
        archivedCompanyIds.length > 0
          ? await TransportCompany.query({ client: trx })
              .whereIn('id', archivedCompanyIds)
              .orderBy('id', 'asc')
              .forUpdate()
          : []
      const archivedCompanyIdSet = new Set(
        companies.filter((company) => company.status === 'ARCHIVED').map((company) => company.id),
      )

      const blockers = findBulkBlockers(
        command.ids,
        trucksById,
        'ARCHIVED',
        undefined,
        archivedCompanyIdSet,
      )

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await Truck.query({ client: trx })
        .whereIn('id', eligibleIds)
        .where('status', 'ARCHIVED')
        .update({
          status: 'AVAILABLE',
          reactivatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
          reactivatedByUserId: command.reactivatedByUserId,
          reactivationComment: command.reactivationComment,
          updatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
        })

      if (affectedRows !== eligibleIds.length) {
        throw new Error('Truck bulk reactivation changed during transaction')
      }

      const reactivated = await Truck.query({ client: trx })
        .whereIn('id', eligibleIds)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')

      return {
        updatedTrucks: orderTrucks(eligibleIds, indexTrucksById(reactivated)),
        blockedTrucks: blockers,
      }
    })
  }

  suspendAvailable(command: SuspendTruckCommand): Promise<SuspendTruckResult> {
    return Truck.transaction(async (trx) => {
      const truck = await Truck.query({ client: trx }).where('id', command.id).forUpdate().first()

      if (!truck) {
        return { kind: 'NOT_FOUND' }
      }
      if (truck.status === 'SUSPENDED') {
        return { kind: 'ALREADY_SUSPENDED' }
      }
      if (truck.status === 'ARCHIVED') {
        return { kind: 'ARCHIVED' }
      }

      // Deliberately no `SiteReferenceUsageChecker` call. Archival refuses a truck reserved by a
      // planned or active discharge; suspension must accept it, because a vehicle breaks down
      // precisely while it is in service and the assignment has to survive the immobilisation.
      //
      // Deliberately no transport-company lock either. `reactivateArchived` locks that row because
      // it *produces* an available truck and could race a company archival. Suspension removes one,
      // so it can only make the "no available truck under an archived company" invariant more true.
      const [affectedRows] = await Truck.query({ client: trx })
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update({
          status: 'SUSPENDED',
          suspendedAt: command.suspendedAt.toSQL({ includeOffset: false }),
          suspendedByUserId: command.suspendedByUserId,
          suspensionComment: command.suspensionComment,
          updatedAt: command.suspendedAt.toSQL({ includeOffset: false }),
        })

      if (affectedRows === 0) {
        // The row read above was AVAILABLE, so a zero-row UPDATE means it moved on in between.
        // PostgreSQL cannot reach this — the `forUpdate()` above holds the row — but knex emits no
        // `FOR UPDATE` on SQLite, where a concurrent archive would otherwise be reported as a
        // successful suspension of a truck that never changed.
        const current = await Truck.query({ client: trx }).where('id', command.id).first()

        if (!current) {
          return { kind: 'NOT_FOUND' }
        }
        if (current.status === 'SUSPENDED') {
          return { kind: 'ALREADY_SUSPENDED' }
        }
        if (current.status === 'ARCHIVED') {
          return { kind: 'ARCHIVED' }
        }

        // Available again already: the caller's read was stale, the same way `updateAvailable`
        // treats a concurrent reactivation.
        return { kind: 'NOT_FOUND' }
      }

      const suspended = await Truck.query({ client: trx })
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .preload('suspendedBy')
        .first()

      if (!suspended) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'SUSPENDED', truck: suspended }
    })
  }
}
