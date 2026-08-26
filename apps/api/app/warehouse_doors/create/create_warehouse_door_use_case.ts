import { inject } from '@adonisjs/core'

import {
  isLegalSiteReferenceLatitude,
  isLegalSiteReferenceLongitude,
  MAX_SITE_REFERENCE_NAME_LENGTH,
  normalizeSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  DuplicateWarehouseDoorNameException,
  InvalidWarehouseDoorCoordinatesException,
  InvalidWarehouseDoorNameException,
  WarehouseDoorOutsideFootprintException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import { containsPoint } from '#warehouses/shared/footprint_geometry'
import {
  ArchivedWarehouseReadOnlyException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

export type CreateWarehouseDoorInput = {
  warehouseId: string
  name: string
  latitude: number
  longitude: number
}

@inject()
export default class CreateWarehouseDoorUseCase {
  constructor(private repository: WarehouseDoorRepository) {}

  async handle(input: CreateWarehouseDoorInput) {
    // The name and coordinate rules are shared with every other site reference, but their error
    // codes are not: this slice reuses the rules and raises its own exceptions, so a door form never
    // has to make sense of an `E_SITE_REFERENCE_*` code it does not map.
    const name = normalizeSiteReferenceName(input.name)

    if (!name || name.length > MAX_SITE_REFERENCE_NAME_LENGTH) {
      throw new InvalidWarehouseDoorNameException()
    }

    if (
      !isLegalSiteReferenceLatitude(input.latitude) ||
      !isLegalSiteReferenceLongitude(input.longitude)
    ) {
      throw new InvalidWarehouseDoorCoordinatesException()
    }

    const result = await this.repository.create({
      warehouseId: input.warehouseId,
      name,
      latitude: input.latitude,
      longitude: input.longitude,
      // The containment decision stays here; the repository only supplies the footprint it read
      // under lock, so the rule is applied to the ring the insert actually lands beside.
      contains: (points) =>
        containsPoint(points, { latitude: input.latitude, longitude: input.longitude }),
    })

    if (result.kind === 'WAREHOUSE_NOT_FOUND') {
      throw new WarehouseNotFoundException()
    }

    if (result.kind === 'WAREHOUSE_ARCHIVED') {
      throw new ArchivedWarehouseReadOnlyException()
    }

    if (result.kind === 'OUTSIDE_FOOTPRINT') {
      throw new WarehouseDoorOutsideFootprintException()
    }

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateWarehouseDoorNameException()
    }

    return result.door
  }
}
