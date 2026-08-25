import { inject } from '@adonisjs/core'

import {
  isLegalSiteReferenceLatitude,
  isLegalSiteReferenceLongitude,
  MAX_SITE_REFERENCE_NAME_LENGTH,
  normalizeSiteReferenceName,
} from '#site_references/shared/normalize_site_reference'
import { assertSimpleFootprint, containsPoint } from '#warehouses/shared/footprint_geometry'
import type { WarehouseDoorPosition } from '#warehouses/shared/repositories/warehouse_repository'
import WarehouseRepository from '#warehouses/shared/repositories/warehouse_repository'
import {
  ArchivedWarehouseReadOnlyException,
  DuplicateWarehouseNameException,
  InvalidWarehouseFootprintException,
  InvalidWarehouseNameException,
  WarehouseDoorsOutsideFootprintException,
  WarehouseNotFoundException,
} from '#warehouses/shared/warehouse_exceptions'

const OUT_OF_RANGE_MESSAGE = 'Warehouse footprint coordinates are out of range'

/**
 * Every door counts, whatever its lifecycle status: an archived door keeps its recorded position
 * inside its warehouse footprint, so letting it fall outside would break the same invariant this
 * check exists to protect.
 */
const excludedDoorNames = (
  points: Array<{ latitude: number; longitude: number }>,
  doors: WarehouseDoorPosition[],
) =>
  doors
    .filter(
      (door) => !containsPoint(points, { latitude: door.latitude, longitude: door.longitude }),
    )
    .map((door) => door.name)

export type UpdateWarehouseInput = {
  id: string
  name?: string
  points?: Array<{ latitude: number; longitude: number }>
}

@inject()
export default class UpdateWarehouseUseCase {
  constructor(private repository: WarehouseRepository) {}

  async handle(input: UpdateWarehouseInput) {
    // The name and coordinate rules are shared with every other site reference, but their error
    // codes are not: this slice reuses the rules and raises its own exceptions, so a warehouse form
    // never has to make sense of an `E_SITE_REFERENCE_*` code it does not map.
    const name = input.name === undefined ? undefined : normalizeSiteReferenceName(input.name)
    const points = input.points

    if (name !== undefined && (!name || name.length > MAX_SITE_REFERENCE_NAME_LENGTH)) {
      throw new InvalidWarehouseNameException()
    }

    if (points !== undefined) {
      for (const point of points) {
        if (
          !isLegalSiteReferenceLatitude(point.latitude) ||
          !isLegalSiteReferenceLongitude(point.longitude)
        ) {
          throw new InvalidWarehouseFootprintException(OUT_OF_RANGE_MESSAGE)
        }
      }

      // Geometry is settled before any transaction opens, so a rejected outline never touches
      // persistence and can leave no half-replaced footprint behind.
      assertSimpleFootprint(points)
    }

    const warehouse = await this.repository.findWithDoors(input.id)

    if (!warehouse) {
      throw new WarehouseNotFoundException()
    }

    if (warehouse.status !== 'AVAILABLE') {
      throw new ArchivedWarehouseReadOnlyException()
    }

    if (points !== undefined) {
      // A refusal the doors already on record make certain is raised here, before any transaction
      // opens, so the administrator is told which door is in the way without paying for a write.
      const excluded = excludedDoorNames(points, warehouse.doors)

      if (excluded.length > 0) {
        throw new WarehouseDoorsOutsideFootprintException(excluded)
      }
    }

    const result = await this.repository.updateAvailable({
      id: input.id,
      ...(name === undefined ? {} : { name }),
      // The same rule travels with the command: the repository applies it again inside the write,
      // against the doors as they stand there, so the read above cannot go stale under it.
      ...(points === undefined
        ? {}
        : { points, excludedDoors: (doors) => excludedDoorNames(points, doors) }),
    })

    if (result.kind === 'NOT_FOUND') {
      throw new WarehouseNotFoundException()
    }

    // The read above already refused an archived warehouse; this guard is what catches one archived
    // between that read and this write.
    if (result.kind === 'ARCHIVED') {
      throw new ArchivedWarehouseReadOnlyException()
    }

    if (result.kind === 'DUPLICATE_NAME') {
      throw new DuplicateWarehouseNameException()
    }

    // A door created or moved between the read above and the write: the outline is refused whole
    // rather than stored around a door it no longer encloses.
    if (result.kind === 'DOORS_OUTSIDE') {
      throw new WarehouseDoorsOutsideFootprintException(result.doorNames)
    }

    if (result.kind !== 'UPDATED') {
      throw new Error(`Unexpected warehouse update result: ${JSON.stringify(result)}`)
    }

    return result.warehouse
  }
}
