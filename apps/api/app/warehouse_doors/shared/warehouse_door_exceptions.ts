import { Exception } from '@adonisjs/core/exceptions'

/**
 * Only the failures that are genuinely about the *door* live here. A missing or archived containing
 * warehouse keeps raising `WarehouseNotFoundException` / `ArchivedWarehouseReadOnlyException` from
 * `#warehouses/shared/warehouse_exceptions`: the failing fact is the warehouse's, and
 * `E_WAREHOUSE_ARCHIVED` already carries the "reactivate it first" guidance the administrator needs.
 *
 * The door's *own* absence and read-only state do belong here, and are deliberately distinct from
 * the warehouse's: the remedies differ — reactivate the door (#216) versus reactivate the warehouse
 * (#211) — so an administrator must be able to tell which one is in the way.
 *
 * `ArchivedWarehouseDoorReadOnlyException` stays the refusal of a *write to* an archived door — its
 * "reactivate the door first" guidance is what an update needs. An archive attempt on an archived
 * door is a different fact: the administrator asked for the state the door is already in, so it
 * answers with `WarehouseDoorAlreadyArchivedException` instead, exactly as every sibling site
 * reference does.
 */
export class WarehouseDoorNotFoundException extends Exception {
  static status = 404
  static code = 'E_WAREHOUSE_DOOR_NOT_FOUND'
  static message = 'Warehouse door not found'
}

export class ArchivedWarehouseDoorReadOnlyException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_DOOR_ARCHIVED'
  static message = 'Archived warehouse doors are read-only. Reactivate the door first.'
}

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

export class WarehouseDoorAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_DOOR_ALREADY_ARCHIVED'
  static message = 'Warehouse door is already archived'
}

export class WarehouseDoorInUseException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_DOOR_IN_USE'
  static message = 'Warehouse door is used by a planned or active discharge'
}
