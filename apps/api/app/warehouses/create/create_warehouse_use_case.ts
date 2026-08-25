import { inject } from '@adonisjs/core'

import {
  assertLegalSiteReferenceLatitude,
  assertLegalSiteReferenceLongitude,
  assertValidSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import { assertSimpleFootprint } from '#warehouses/shared/footprint_geometry'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import { DuplicateWarehouseNameException } from '#warehouses/shared/warehouse_exceptions'

export type CreateWarehouseInput = {
  name: string
  points: Array<{ latitude: number; longitude: number }>
}

@inject()
export default class CreateWarehouseUseCase {
  constructor(private repository: WarehouseRepository) {}

  async handle(input: CreateWarehouseInput) {
    const name = assertValidSiteReferenceName(input.name)

    for (const point of input.points) {
      assertLegalSiteReferenceLatitude(point.latitude)
      assertLegalSiteReferenceLongitude(point.longitude)
    }

    // Geometry is settled before any transaction opens, so a rejected outline never touches
    // persistence and can leave no partial warehouse behind.
    assertSimpleFootprint(input.points)

    const result = await this.repository.create({ name, points: input.points })

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateWarehouseNameException()
    }

    return result.warehouse
  }
}
