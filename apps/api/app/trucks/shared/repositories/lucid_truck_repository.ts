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
    return Truck.query().where('id', id).preload('archivedBy').preload('reactivatedBy').first()
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
      const blockers = findBulkBlockers(command.ids, trucksById, usedIds)

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

      return {
        updatedTrucks: orderTrucks(eligibleIds, indexTrucksById(archived)),
        blockedTrucks: blockers,
      }
    })
  }
}
