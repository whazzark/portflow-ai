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

export class WarehouseInUseException extends Exception {
  static status = 409
  static code = 'E_WAREHOUSE_IN_USE'
  static message = 'A door of this warehouse is used by a planned or active discharge'
}
