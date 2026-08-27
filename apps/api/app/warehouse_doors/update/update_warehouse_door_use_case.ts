import { inject } from '@adonisjs/core'

import {
  isLegalSiteReferenceLatitude,
  isLegalSiteReferenceLongitude,
  MAX_SITE_REFERENCE_NAME_LENGTH,
  normalizeSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import WarehouseDoorRepository from '#warehouse_doors/shared/repositories/warehouse_door_repository'
import {
  ArchivedWarehouseDoorReadOnlyException,
  DuplicateWarehouseDoorNameException,
  InvalidWarehouseDoorCoordinatesException,
  InvalidWarehouseDoorNameException,
  WarehouseDoorNotFoundException,
  WarehouseDoorOutsideFootprintException,
} from '#warehouse_doors/shared/warehouse_door_exceptions'
import { containsPoint } from '#warehouses/shared/footprint_geometry'
import {
  ArchivedWarehouseReadOnlyException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

/**
 * The containing warehouse, the lifecycle status, and the creation time are absent by construction:
 * a door belongs permanently to one warehouse (`CONTEXT.md`), archival and reactivation are #215
 * and #216, and history is not rewritten. A caller sending them is simply not describing anything
 * this use case can act on.
 */
export type UpdateWarehouseDoorInput = {
  id: string
  name?: string
  latitude?: number
  longitude?: number
}

@inject()
export default class UpdateWarehouseDoorUseCase {
  constructor(private repository: WarehouseDoorRepository) {}

  async handle(input: UpdateWarehouseDoorInput) {
    // The name and coordinate rules are shared with every other site reference, but their error
    // codes are not: this slice reuses the rules and raises its own exceptions, so a door form never
    // has to make sense of an `E_SITE_REFERENCE_*` code it does not map.
    const name = input.name === undefined ? undefined : normalizeSiteReferenceName(input.name)

    if (name !== undefined && (!name || name.length > MAX_SITE_REFERENCE_NAME_LENGTH)) {
      throw new InvalidWarehouseDoorNameException()
    }

    // Latitude and longitude travel together, so one being present settles the other.
    const hasPosition = input.latitude !== undefined && input.longitude !== undefined
    const latitude = input.latitude
    const longitude = input.longitude

    if (
      (latitude !== undefined && !isLegalSiteReferenceLatitude(latitude)) ||
      (longitude !== undefined && !isLegalSiteReferenceLongitude(longitude))
    ) {
      throw new InvalidWarehouseDoorCoordinatesException()
    }

    const result = await this.repository.updateAvailable({
      id: input.id,
      ...(name === undefined ? {} : { name }),
      ...(hasPosition ? { latitude, longitude } : {}),
      // The containment decision stays here; the repository only supplies the footprint it read
      // under lock, so the rule is applied to the ring the update actually lands beside. Omitted
      // entirely on a name-only update: the stored position is already inside, and #209 refuses any
      // reshape that would leave it outside, so a rename has nothing to answer for.
      ...(hasPosition
        ? {
            contains: (points) =>
              containsPoint(points, {
                latitude: latitude as number,
                longitude: longitude as number,
              }),
          }
        : {}),
    })

    if (result.kind === 'DOOR_NOT_FOUND') {
      throw new WarehouseDoorNotFoundException()
    }

    if (result.kind === 'DOOR_ARCHIVED') {
      throw new ArchivedWarehouseDoorReadOnlyException()
    }

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
