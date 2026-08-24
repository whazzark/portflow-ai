import { Exception } from '@adonisjs/core/exceptions'

export class DuplicateTruckRegistrationException extends Exception {
  static status = 409
  static code = 'E_TRUCK_REGISTRATION_CONFLICT'
  static message = 'Truck registration is already in use'
}

export class InvalidTransportCompanyException extends Exception {
  static status = 422
  static code = 'E_TRUCK_TRANSPORT_COMPANY_INVALID'
  static message = 'Transport company must exist and be available'
}
