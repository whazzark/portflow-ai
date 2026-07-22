import { inject } from '@adonisjs/core'

import {
  DuplicateDockNameException,
  InvalidDockCoordinatesException,
  InvalidDockNameException,
} from '#docks/shared/dock_exceptions'
import { isLegalLatitude, isLegalLongitude, normalizeDockName } from '#docks/shared/normalize_dock'
import DockRepository from '#docks/shared/repositories/dock_repository'

export type CreateDockInput = { name: string; latitude: number; longitude: number }

@inject()
export default class CreateDockUseCase {
  constructor(private dockRepository: DockRepository) {}

  async handle(input: CreateDockInput) {
    const name = normalizeDockName(input.name)

    if (!name) {
      throw new InvalidDockNameException()
    }

    if (!isLegalLatitude(input.latitude) || !isLegalLongitude(input.longitude)) {
      throw new InvalidDockCoordinatesException()
    }

    const result = await this.dockRepository.create({ ...input, name })

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateDockNameException()
    }

    if (result.kind !== 'CREATED') {
      throw new Error(`Unexpected dock creation result: ${result.kind}`)
    }

    return result.dock
  }
}
