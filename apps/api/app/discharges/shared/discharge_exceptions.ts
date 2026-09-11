import { Exception } from '@adonisjs/core/exceptions'

export class DischargeNotFoundException extends Exception {
  static status = 404
  static code = 'E_DISCHARGE_NOT_FOUND'
  static message = 'Discharge not found'
}
