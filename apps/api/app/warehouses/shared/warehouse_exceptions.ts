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
