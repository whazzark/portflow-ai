import { inject } from '@adonisjs/core'
import {
  assertLegalSiteReferenceLatitude,
  assertLegalSiteReferenceLongitude,
  assertValidSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import WeighingAreaRepository from '#weighing_areas/shared/repositories/weighing_area_repository'
import {
  ArchivedWeighingAreaReadOnlyException,
  DuplicateWeighingAreaNameException,
  WeighingAreaNotFoundException,
} from '#weighing_areas/shared/weighing_area_exceptions'

export type UpdateWeighingAreaInput = {
  id: string
  name?: string
  latitude?: number
  longitude?: number
}

@inject()
export default class UpdateWeighingAreaUseCase {
  constructor(private repository: WeighingAreaRepository) {}

  async handle(input: UpdateWeighingAreaInput) {
    const values = {
      ...(input.name === undefined ? {} : { name: assertValidSiteReferenceName(input.name) }),
      ...(input.latitude === undefined ? {} : { latitude: input.latitude }),
      ...(input.longitude === undefined ? {} : { longitude: input.longitude }),
    }

    if (values.latitude !== undefined) {
      assertLegalSiteReferenceLatitude(values.latitude)
    }

    if (values.longitude !== undefined) {
      assertLegalSiteReferenceLongitude(values.longitude)
    }

    const result = await this.repository.updateAvailable({ id: input.id, ...values })

    if (result.kind === 'NOT_FOUND') {
      throw new WeighingAreaNotFoundException()
    }

    if (result.kind === 'ARCHIVED') {
      throw new ArchivedWeighingAreaReadOnlyException()
    }

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateWeighingAreaNameException()
    }

    return result.weighingArea
  }
}
