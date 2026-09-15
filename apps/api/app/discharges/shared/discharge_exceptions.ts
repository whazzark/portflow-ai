import { Exception } from '@adonisjs/core/exceptions'

export class DischargeNotFoundException extends Exception {
  static status = 404
  static code = 'E_DISCHARGE_NOT_FOUND'
  static message = 'Discharge not found'
}

export class DischargeNotPlannedException extends Exception {
  static status = 409
  static code = 'E_DISCHARGE_NOT_PLANNED'
  static message = 'Only a planned discharge can be corrected'
}

export class ProductLotNotFoundException extends Exception {
  static status = 404
  static code = 'E_PRODUCT_LOT_NOT_FOUND'
  static message = 'Product lot not found'
}

export class LastProductLotException extends Exception {
  static status = 409
  static code = 'E_DISCHARGE_LAST_PRODUCT_LOT'
  static message = 'A discharge needs at least one product lot'
}

export class ProductLotHasDoorAssignmentsException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS'
  static message = 'This product lot has warehouse door assignments'
}
