import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import WeighingArea from '#models/weighing_area'
import isUniqueViolation from '#shared/database/is_unique_violation'
import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'
import SiteReferenceUsageChecker from '#site_references/shared/site_reference_usage_checker'
import { findBulkBlockers } from '#weighing_areas/shared/weighing_area_lifecycle_blockers'

import WeighingAreaRepository, {
  type ArchiveWeighingAreaCommand,
  type ArchiveWeighingAreaResult,
  type ArchiveWeighingAreasCommand,
  type BulkWeighingAreaLifecycleResult,
  type CreateWeighingAreaCommand,
  type CreateWeighingAreaResult,
  type ReactivateWeighingAreaCommand,
  type ReactivateWeighingAreaResult,
  type ReactivateWeighingAreasCommand,
  type UpdateWeighingAreaCommand,
  type UpdateWeighingAreaResult,
} from './weighing_area_repository.ts'

@inject()
export default class LucidWeighingAreaRepository extends WeighingAreaRepository {
  constructor(private usageChecker: SiteReferenceUsageChecker) {
    super()
  }

  async create(command: CreateWeighingAreaCommand): Promise<CreateWeighingAreaResult> {
    try {
      return {
        kind: 'CREATED',
        weighingArea: await WeighingArea.create({ ...command, status: 'AVAILABLE' }),
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  list(): Promise<WeighingArea[]> {
    return WeighingArea.query()
      .orderByRaw('LOWER(name) ASC')
      .orderBy('name', 'asc')
      .orderBy('id', 'asc')
  }

  listAvailable(): Promise<WeighingArea[]> {
    return WeighingArea.query().where('status', 'AVAILABLE').orderBy('name', 'asc')
  }

  findById(id: string): Promise<WeighingArea | null> {
    return WeighingArea.find(id)
  }

  async updateAvailable(command: UpdateWeighingAreaCommand): Promise<UpdateWeighingAreaResult> {
    const values = {
      ...(command.name === undefined ? {} : { name: command.name }),
      ...(command.latitude === undefined ? {} : { latitude: command.latitude }),
      ...(command.longitude === undefined ? {} : { longitude: command.longitude }),
      updatedAt: DateTime.now().toISO(),
    }

    try {
      const [affectedRows] = await WeighingArea.query()
        .where('id', command.id)
        .where('status', 'AVAILABLE')
        .update(values)

      if (affectedRows === 0) {
        const area = await WeighingArea.find(command.id)

        if (!area) {
          return { kind: 'NOT_FOUND' }
        }

        if (area.status !== 'AVAILABLE') {
          return { kind: 'ARCHIVED' }
        }

        return { kind: 'NOT_FOUND' }
      }

      const area = await WeighingArea.find(command.id)

      return area ? { kind: 'UPDATED', weighingArea: area } : { kind: 'NOT_FOUND' }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { kind: 'DUPLICATE_NAME' }
      }

      throw error
    }
  }

  async archiveAvailable(command: ArchiveWeighingAreaCommand): Promise<ArchiveWeighingAreaResult> {
    const [affectedRows] = await WeighingArea.query()
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
      const area = await WeighingArea.find(command.id)

      if (!area) {
        return { kind: 'NOT_FOUND' }
      }

      return area.status === 'ARCHIVED' ? { kind: 'ALREADY_ARCHIVED' } : { kind: 'NOT_FOUND' }
    }

    const area = await WeighingArea.find(command.id)

    return area ? { kind: 'ARCHIVED', weighingArea: area } : { kind: 'NOT_FOUND' }
  }

  async reactivateArchived(
    command: ReactivateWeighingAreaCommand,
  ): Promise<ReactivateWeighingAreaResult> {
    const [affectedRows] = await WeighingArea.query()
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
      const area = await WeighingArea.find(command.id)

      if (!area) {
        return { kind: 'NOT_FOUND' }
      }

      return area.status === 'AVAILABLE' ? { kind: 'ALREADY_AVAILABLE' } : { kind: 'NOT_FOUND' }
    }

    const area = await WeighingArea.find(command.id)

    return area ? { kind: 'REACTIVATED', weighingArea: area } : { kind: 'NOT_FOUND' }
  }

  archiveAvailableMany(
    command: ArchiveWeighingAreasCommand,
  ): Promise<BulkWeighingAreaLifecycleResult> {
    return WeighingArea.transaction(async (trx) => {
      // Ordered by id so concurrent bulk archives and reactivations over overlapping id sets
      // always take the row locks in the same order, and can never deadlock each other.
      const areas = await WeighingArea.query({ client: trx })
        .whereIn('id', command.ids)
        .orderBy('id')
        .forUpdate()
      const areasById = indexById(areas)
      const usedIds = await this.usageChecker.findUsedByPlannedOrActiveDischarge({
        referenceType: 'WEIGHING_AREA',
        referenceIds: command.ids,
        client: trx,
      })
      const blockers = findBulkBlockers(command.ids, areasById, 'AVAILABLE', usedIds)

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await WeighingArea.query({ client: trx })
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
        throw new Error('Weighing area bulk archive changed during transaction')
      }

      const archived = await WeighingArea.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedWeighingAreas: orderByIds(eligibleIds, indexById(archived)),
        blockedWeighingAreas: blockers,
      }
    })
  }

  reactivateArchivedMany(
    command: ReactivateWeighingAreasCommand,
  ): Promise<BulkWeighingAreaLifecycleResult> {
    return WeighingArea.transaction(async (trx) => {
      // Ordered by id so concurrent bulk archives and reactivations over overlapping id sets
      // always take the row locks in the same order, and can never deadlock each other.
      const areas = await WeighingArea.query({ client: trx })
        .whereIn('id', command.ids)
        .orderBy('id')
        .forUpdate()
      const areasById = indexById(areas)
      // No usage lookup on this direction: an archived weighing area holds no shift membership in
      // a planned or active discharge, so IN_USE is structurally unreachable here.
      const blockers = findBulkBlockers(command.ids, areasById, 'ARCHIVED')

      const blockedIds = new Set(blockers.map((blocker) => blocker.id))
      const eligibleIds = command.ids.filter((id) => !blockedIds.has(id))

      const [affectedRows] = await WeighingArea.query({ client: trx })
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
        throw new Error('Weighing area bulk reactivation changed during transaction')
      }

      const reactivated = await WeighingArea.query({ client: trx }).whereIn('id', eligibleIds)

      return {
        updatedWeighingAreas: orderByIds(eligibleIds, indexById(reactivated)),
        blockedWeighingAreas: blockers,
      }
    })
  }
}
