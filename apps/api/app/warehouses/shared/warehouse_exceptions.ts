import { Exception } from '@adonisjs/core/exceptions'

export class DuplicateWarehouseNameException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_NAME_CONFLICT'
  static message = 'Warehouse name is already in use'
}

export class InvalidWarehouseNameException extends Exception {
  static status = 422
  static code = 'E_WAREHOUSE_NAME_INVALID'
  static message = 'Warehouse name must not be empty'
}

export class InvalidWarehouseFootprintException extends Exception {
  static status = 422
  static code = 'E_WAREHOUSE_INVALID_FOOTPRINT'
  static message = 'Warehouse footprint outline must not cross itself'
}

export class WarehouseNotFoundException extends Exception {
  static status = 404
  static code = 'E_WAREHOUSE_NOT_FOUND'
  static message = 'Warehouse not found'
}

export class WarehouseAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_ALREADY_ARCHIVED'
  static message = 'Warehouse is already archived'
}

export class WarehouseAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_ALREADY_AVAILABLE'
  static message = 'Warehouse is already available'
}

export class WarehouseInUseException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_IN_USE'
  static message = 'A door of this warehouse is used by a planned or active discharge'
}

export class ArchivedWarehouseReadOnlyException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_ARCHIVED'
  static message = 'Archived warehouses are read-only. Reactivate the warehouse first.'
}

export class WarehouseDoorsOutsideFootprintException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_DOORS_OUTSIDE_FOOTPRINT'
  static message = 'Warehouse doors would fall outside the new footprint'

  /** The offending doors are named so the administrator can shape the outline around them rather
   * than guess which one is in the way. */
  constructor(doorNames: string[]) {
    super(
      doorNames.length === 0
        ? WarehouseDoorsOutsideFootprintException.message
        : `Doors ${doorNames.join(', ')} would fall outside the new footprint`,
    )
  }
}
