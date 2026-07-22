import { DateTime } from 'luxon'

import WeighingArea from '#models/weighing_area'
import isUniqueViolation from '#shared/database/is_unique_violation'

import WeighingAreaRepository, {
  type ArchiveWeighingAreaCommand,
  type ArchiveWeighingAreaResult,
  type CreateWeighingAreaCommand,
  type CreateWeighingAreaResult,
  type ReactivateWeighingAreaCommand,
  type ReactivateWeighingAreaResult,
  type UpdateWeighingAreaCommand,
  type UpdateWeighingAreaResult,
} from './weighing_area_repository.ts'

export default class LucidWeighingAreaRepository extends WeighingAreaRepository {
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
    return WeighingArea.query().orderBy('name', 'asc')
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
}
