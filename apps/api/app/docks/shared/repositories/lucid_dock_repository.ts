import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import { findBulkBlockers, indexDocksById, orderDocks } from '#docks/shared/dock_lifecycle_blockers'
import Dock from '#models/dock'
import isUniqueViolation from '#shared/database/is_unique_violation'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'

import type {
  ArchiveDockCommand,
  ArchiveDockResult,
  ArchiveDocksCommand,
  BulkDockLifecycleResult,
  CreateDockCommand,
  DockWriteResult,
  ReactivateDockCommand,
  ReactivateDockResult,
  UpdateDockCommand,
} from './dock_repository.ts'
import DockRepository from './dock_repository.ts'

@inject()
export default class LucidDockRepository extends DockRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

  async create(command: CreateDockCommand): Promise<DockWriteResult> {
    try {
      const dock = await Dock.create({ ...command, status: 'AVAILABLE' })

      return { kind: 'CREATED', dock }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  list(): Promise<Dock[]> {
    return Dock.query().orderBy('name', 'asc')
  }

  listAvailable(): Promise<Dock[]> {
    return Dock.query().where('status', 'AVAILABLE').orderBy('name', 'asc')
  }

  findById(id: string): Promise<Dock | null> {
    return Dock.find(id)
  }

  async updateAvailable(command: UpdateDockCommand): Promise<DockWriteResult> {
    const values = {
      ...(command.name === undefined ? {} : { name: command.name }),
      ...(command.latitude === undefined ? {} : { latitude: command.latitude }),
      ...(command.longitude === undefined ? {} : { longitude: command.longitude }),
      updatedAt: DateTime.now().toISO(),
    }

    try {
      const [affectedRows] = await Dock.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update(values)

      if (affectedRows === 0) {
        const dock = await Dock.find(command.id)

        if (!dock) {
          return { kind: 'NOT_FOUND' }
        }

        if (dock.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }

        return { kind: 'NOT_FOUND' }
      }

      const dock = await Dock.find(command.id)

      return dock ? { kind: 'UPDATED', dock } : { kind: 'NOT_FOUND' }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  async archiveAvailable(command: ArchiveDockCommand): Promise<ArchiveDockResult> {
    const [affectedRows] = await Dock.query()
      .where('id', command.id)
      .where('status', 'AVAILABLE')
      .update({
        status: 'ARCHIVED',
        archivedAt: command.archivedAt.toSQL({ includeOffset: false }),
        archivedByUserId: command.archivedByUserId,
        archiveComment: command.archiveComment,
        updatedAt: command.archivedAt.toSQL({ includeOffset: false }),
      })

    if (affectedRows === 0) {
      const dock = await Dock.find(command.id)

      if (!dock) {
        return { kind: 'NOT_FOUND' }
      }

      return dock.status === 'ARCHIVED' ? { kind: 'ALREADY_ARCHIVED' } : { kind: 'NOT_FOUND' }
    }

    const dock = await Dock.find(command.id)

    return dock ? { kind: 'ARCHIVED', dock } : { kind: 'NOT_FOUND' }
  }

  async reactivateArchived(command: ReactivateDockCommand): Promise<ReactivateDockResult> {
    const [affectedRows] = await Dock.query()
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
      const dock = await Dock.find(command.id)

      if (!dock) {
        return { kind: 'NOT_FOUND' }
      }

      return dock.status === 'AVAILABLE' ? { kind: 'ALREADY_AVAILABLE' } : { kind: 'NOT_FOUND' }
    }

    const dock = await Dock.find(command.id)

    return dock ? { kind: 'REACTIVATED', dock } : { kind: 'NOT_FOUND' }
  }

  archiveAvailableMany(command: ArchiveDocksCommand): Promise<BulkDockLifecycleResult> {
    return Dock.transaction(async (trx) => {
      const docks = await Dock.query({ client: trx }).whereIn('id', command.ids).forUpdate()
      const docksById = indexDocksById(docks)
      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'DOCK',
        referenceIds: command.ids,
        client: trx,
      })
      const blockers = findBulkBlockers(command.ids, docksById, 'AVAILABLE', usedIds)

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await Dock.query({ client: trx })
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
        throw new Error('Dock bulk archive changed during transaction')
      }

      const archived = await Dock.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedDocks: orderDocks(eligibleIds, indexDocksById(archived)),
        blockedDocks: blockers,
      }
    })
  }
}
