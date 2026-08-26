import { Exception } from '@adonisjs/core/exceptions'

/**
 * Only the failures that are genuinely about the *door* live here. A missing or archived containing
 * warehouse keeps raising `WarehouseNotFoundException` / `ArchivedWarehouseReadOnlyException` from
 * `#warehouses/shared/warehouse_exceptions`: the failing fact is the warehouse's, and
 * `E_WAREHOUSE_ARCHIVED` already carries the "reactivate it first" guidance the administrator needs.
 */
export class DuplicateWarehouseDoorNameException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_DOOR_NAME_CONFLICT'
  static message = 'Warehouse door name is already in use in this warehouse'
}

export class InvalidWarehouseDoorNameException extends Exception {
  static status = 422
  static code = 'E_WAREHOUSE_DOOR_NAME_INVALID'
  static message = 'Warehouse door name must not be empty'
}

export class InvalidWarehouseDoorCoordinatesException extends Exception {
  static status = 422
  static code = 'E_WAREHOUSE_DOOR_COORDINATES_INVALID'
  static message = 'Warehouse door coordinates are out of range'
}

export class WarehouseDoorOutsideFootprintException extends Exception {
  static status = 422
  static code = 'E_WAREHOUSE_DOOR_OUTSIDE_FOOTPRINT'
  static message = 'Warehouse door must be placed within its warehouse footprint'
}
