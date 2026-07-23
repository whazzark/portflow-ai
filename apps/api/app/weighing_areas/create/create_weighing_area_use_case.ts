import { inject } from '@adonisjs/core'

import {
  assertLegalSiteReferenceLatitude,
  assertLegalSiteReferenceLongitude,
  assertValidSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'
import { DuplicateWeighingAreaNameException } from '#weighing_areas/shared/weighing_area_exceptions'

export type CreateWeighingAreaInput = { name: string; latitude: number; longitude: number }

@inject()
export default class CreateWeighingAreaUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  async handle(input: CreateWeighingAreaInput) {
    const name = assertValidSiteReferenceName(input.name)
    assertLegalSiteReferenceLatitude(input.latitude)
    assertLegalSiteReferenceLongitude(input.longitude)

    const result = await this.repository.create({ ...input, name })

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateWeighingAreaNameException()
    }

    return result.weighingArea
  }
}
