import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import TransportCompany from '#models/transport_company'
import isUniqueViolation from '#shared/database/is_unique_violation'
import {
  findBulkBlockers,
  indexCompaniesById,
  orderCompanies,
} from '#transport_companies/shared/transport_company_lifecycle_blockers'
import TruckRepository from '#trucks/shared/repositories/truck_repository'

import TransportCompanyRepository, {
  type ArchiveTransportCompaniesCommand,
  type ArchiveTransportCompanyCommand,
  type ArchiveTransportCompanyResult,
  type BulkTransportCompanyLifecycleResult,
  type CreateTransportCompanyCommand,
  type ReactivateTransportCompaniesCommand,
  type ReactivateTransportCompanyCommand,
  type ReactivateTransportCompanyResult,
  type TransportCompanyWriteResult,
  type UpdateTransportCompanyCommand,
} from './transport_company_repository.ts'

@inject()
export default class LucidTransportCompanyRepository extends TransportCompanyRepository {
  constructor(private truckRepository: TruckRepository) {
    super()
  }

  async create(command: CreateTransportCompanyCommand): Promise<TransportCompanyWriteResult> {
    try {
      const company = await TransportCompany.create({
        ...command,
        status: 'AVAILABLE',
        // Set explicitly rather than left unset: the columns default to NULL, but an unset
        // attribute stays `undefined` on the in-memory model and would be dropped from the
        // serialized response instead of being reported as null.
        archivedAt: null,
        archivedByUserId: null,
        archiveComment: null,
        reactivatedAt: null,
        reactivatedByUserId: null,
        reactivationComment: null,
      })

      // A new company has no archive or reactivation actor by construction, so the lifecycle
      // relations have nothing to preload and the transformer already emits null for them.
      return { kind: 'CREATED', company }
    } catch (error) {
      // The generated primary key cannot realistically collide, so the only unique constraint an
      // INSERT on this table can violate is transport_companies_name_unique.
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  list(): Promise<TransportCompany[]> {
    return TransportCompany.query()
      .preload('archivedBy')
      .preload('reactivatedBy')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  listAvailable(): Promise<TransportCompany[]> {
    return TransportCompany.query()
      .where('status', 'AVAILABLE')
      .preload('archivedBy')
      .preload('reactivatedBy')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  findById(id: string): Promise<TransportCompany | null> {
    return TransportCompany.query().where('id', id).first()
  }

  async updateAvailable(
    command: UpdateTransportCompanyCommand,
  ): Promise<TransportCompanyWriteResult> {
    try {
      const [affectedRows] = await TransportCompany.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update({
          name: command.name,
          contactPhone: command.contactPhone,
          contactEmail: command.contactEmail,
          updatedAt: DateTime.now().toSQL({ includeOffset: false }),
        })

      if (affectedRows === 0) {
        const company = await TransportCompany.find(command.id)

        if (!company) {
          return { kind: 'NOT_FOUND' }
        }
        if (company.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }

        // The row is AVAILABLE now but the UPDATE above matched no rows: it was reactivated
        // concurrently between the UPDATE and this refetch. Treat it like the caller's original
        // read was stale rather than reporting a misleading success.
        return { kind: 'NOT_FOUND' }
      }

      const company = await TransportCompany.query()
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .first()
      if (!company) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'UPDATED', company }
    } catch (error) {
      // The only unique constraint that an UPDATE on this table can violate is the name index:
      // the WHERE clause targets an existing id, so the primary key can't collide.
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  archiveAvailable(
    command: ArchiveTransportCompanyCommand,
  ): Promise<ArchiveTransportCompanyResult> {
    return TransportCompany.transaction(async (trx) => {
      // Locking the row before checking trucks closes the race the two-step check-then-write used
      // to have: truck creation (LucidTruckRepository#create) locks this same company row before
      // inserting an AVAILABLE truck, so whichever of the two transactions runs first is fully
      // committed before the other observes the company's state.
      const company = await TransportCompany.query({ client: trx })
        .where('id', command.id)
        .forUpdate()
        .first()

      if (!company) {
        return { kind: 'NOT_FOUND' }
      }
      if (company.status === 'ARCHIVED') {
        return { kind: 'ALREADY_ARCHIVED' }
      }

      const idsWithAvailableTrucks = await this.truckRepository.findCompanyIdsWithAvailableTrucks({
        transportCompanyIds: [command.id],
        client: trx,
      })
      if (idsWithAvailableTrucks.has(command.id)) {
        return { kind: 'HAS_AVAILABLE_TRUCKS' }
      }

      await TransportCompany.query({ client: trx })
        .where('id', command.id)
        .update({
          status: 'ARCHIVED',
          archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
          archivedByUserId: command.archivedByUserId,
          archiveComment: command.archiveComment,
          updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
        })

      const archived = await TransportCompany.query({ client: trx })
        .where('id', command.id)
        .preload('archivedBy')
        .preload('reactivatedBy')
        .first()
      if (!archived) {
        return { kind: 'NOT_FOUND' }
      }

      return { kind: 'ARCHIVED', company: archived }
    })
  }

  archiveAvailableMany(
    command: ArchiveTransportCompaniesCommand,
  ): Promise<BulkTransportCompanyLifecycleResult> {
    return TransportCompany.transaction(async (trx) => {
      const companies = await TransportCompany.query({ client: trx })
        .whereIn('id', command.ids)
        .forUpdate()
      const companiesById = indexCompaniesById(companies)
      const companyIdsWithAvailableTrucks =
        await this.truckRepository.findCompanyIdsWithAvailableTrucks({
          transportCompanyIds: command.ids,
          client: trx,
        })
      const blockers = findBulkBlockers(
        command.ids,
        companiesById,
        'AVAILABLE',
        companyIdsWithAvailableTrucks,
      )

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await TransportCompany.query({ client: trx })
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
        throw new Error('Transport company bulk archive changed during transaction')
      }

      const archived = await TransportCompany.query({ client: trx })
        .whereIn('id', eligibleIds)
        .preload('archivedBy')
        .preload('reactivatedBy')

      return {
        updatedCompanies: orderCompanies(eligibleIds, indexCompaniesById(archived)),
        blockedCompanies: blockers,
      }
    })
  }

  async reactivateArchived(
    command: ReactivateTransportCompanyCommand,
  ): Promise<ReactivateTransportCompanyResult> {
    // Unlike `archiveAvailable`, this write reads no second table and races with nothing else, so
    // a single conditional UPDATE is already atomic — no transaction, no `forUpdate` lock.
    const [affectedRows] = await TransportCompany.query()
      .where('id', command.id)
      .where('status', 'ARCHIVED')
      .update({
        status: 'AVAILABLE',
        reactivatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
        reactivatedByUserId: command.reactivatedByUserId,
        reactivationComment: command.reactivationComment,
        updatedAt: command.reactivatedAt.toSQL({ includeOffset: false }),
      })

    if (affectedRows === 0) {
      const company = await TransportCompany.find(command.id)

      if (!company) {
        return { kind: 'NOT_FOUND' }
      }
      if (company.status === 'AVAILABLE') {
        return { kind: 'ALREADY_AVAILABLE' }
      }

      // The row is ARCHIVED again but the UPDATE above matched no rows: it was archived
      // concurrently between the UPDATE and this refetch. Treat it like the caller's original
      // read was stale rather than reporting a misleading success.
      return { kind: 'NOT_FOUND' }
    }

    const company = await TransportCompany.query()
      .where('id', command.id)
      .preload('archivedBy')
      .preload('reactivatedBy')
      .first()
    if (!company) {
      return { kind: 'NOT_FOUND' }
    }

    return { kind: 'REACTIVATED', company }
  }

  reactivateArchivedMany(
    command: ReactivateTransportCompaniesCommand,
  ): Promise<BulkTransportCompanyLifecycleResult> {
    return TransportCompany.transaction(async (trx) => {
      const companies = await TransportCompany.query({ client: trx })
        .whereIn('id', command.ids)
        .forUpdate()
      const companiesById = indexCompaniesById(companies)
      // No truck read here, unlike archiveAvailableMany: reactivation has no blocking rule, so
      // findBulkBlockers is called with its truck-set parameter left at its default empty set.
      const blockers = findBulkBlockers(command.ids, companiesById, 'ARCHIVED')

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await TransportCompany.query({ client: trx })
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
        throw new Error('Transport company bulk reactivation changed during transaction')
      }

      const reactivated = await TransportCompany.query({ client: trx })
        .whereIn('id', eligibleIds)
        .preload('archivedBy')
        .preload('reactivatedBy')

      return {
        updatedCompanies: orderCompanies(eligibleIds, indexCompaniesById(reactivated)),
        blockedCompanies: blockers,
      }
    })
  }
}
