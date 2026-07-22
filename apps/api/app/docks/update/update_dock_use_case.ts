import { inject } from '@adonisjs/core'

import {
  ArchivedDockReadOnlyException,
  DockNotFoundException,
  DuplicateDockNameException,
  InvalidDockCoordinatesException,
  InvalidDockNameException,
} from '#docks/shared/dock_exceptions'
import { isLegalLatitude, isLegalLongitude, normalizeDockName } from '#docks/shared/normalize_dock'
import DockRepository from '#docks/shared/repositories/dock_repository'

export type UpdateDockInput = { id: string; name?: string; latitude?: number; longitude?: number }

@inject()
export default class UpdateDockUseCase {
  constructor(private dockRepository: DockRepository) {}

  async handle(input: UpdateDockInput) {
    const values = {
      ...(input.name === undefined ? {} : { name: normalizeDockName(input.name) }),
      ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
      ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
    }
    if (values.name === '') {
      throw new InvalidDockNameException()
    }
    if (
      (values.latitude !== undefined && !isLegalLatitude(values.latitude)) ||
      (values.longitude !== undefined && !isLegalLongitude(values.longitude))
    ) {
      throw new InvalidDockCoordinatesException()
    }

    const result = await this.dockRepository.updateAvailable({ id: input.id, ...values })
    if (result.kind === 'NOT_FOUND') {
      throw new DockNotFoundException()
    }
    if (result.kind === 'ARCHIVED') {
      throw new ArchivedDockReadOnlyException()
    }
    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateDockNameException()
    }
    if (result.kind !== 'UPDATED') {
      throw new Error(`Unexpected dock update result: ${result.kind}`)
    }
    return result.dock
  }
}
