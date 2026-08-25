import { inject } from '@adonisjs/core'

import {
  isLegalSiteReferenceLatitude,
  isLegalSiteReferenceLongitude,
  MAX_SITE_REFERENCE_NAME_LENGTH,
  normalizeSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import { assertSimpleFootprint } from '#warehouses/shared/footprint_geometry'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  DuplicateWarehouseNameException,
  InvalidWarehouseFootprintException,
  InvalidWarehouseNameException,
} from '#warehouses/shared/warehouse_exceptions'

const OUT_OF_RANGE_MESSAGE = 'Warehouse footprint coordinates are out of range'

export type CreateWarehouseInput = {
  name: string
  points: Array<{ latitude: number; longitude: number }>
}

@inject()
export default class CreateWarehouseUseCase {
  constructor(private repository: WarehouseRepository) {}

  async handle(input: CreateWarehouseInput) {
    // The name and coordinate rules are shared with every other site reference, but their error
    // codes are not: this slice reuses the rules and raises its own exceptions, so a warehouse form
    // never has to make sense of an `E_SITE_REFERENCE_*` code it does not map.
    const name = normalizeSiteReferenceName(input.name)

    if (!name || name.length > MAX_SITE_REFERENCE_NAME_LENGTH) {
      throw new InvalidWarehouseNameException()
    }

    for (const point of input.points) {
      if (
        !isLegalSiteReferenceLatitude(point.latitude) ||
        !isLegalSiteReferenceLongitude(point.longitude)
      ) {
        throw new InvalidWarehouseFootprintException(OUT_OF_RANGE_MESSAGE)
      }
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
