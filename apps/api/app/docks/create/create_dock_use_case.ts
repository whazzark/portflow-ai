import { inject } from '@adonisjs/core'

import { DuplicateDockNameException } from '#docks/shared/dock_exceptions'
import DockRepository from '#docks/shared/repositories/dock_repository'
import {
  assertLegalSiteReferenceLatitude,
  assertLegalSiteReferenceLongitude,
  assertValidSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'

export type CreateDockInput = { name: string; latitude: number; longitude: number }

@inject()
export default class CreateDockUseCase {
  constructor(private dockRepository: DockRepository) {}

  async handle(input: CreateDockInput) {
    const name = assertValidSiteReferenceName(input.name)
    assertLegalSiteReferenceLatitude(input.latitude)
    assertLegalSiteReferenceLongitude(input.longitude)

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
