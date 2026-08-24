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

export class TruckNotFoundException extends Exception {
  static status = 404
  static code = 'E_TRUCK_NOT_FOUND'
  static message = 'Truck not found'
}

export class ArchivedTruckReadOnlyException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ARCHIVED'
  static message = 'Archived trucks are read-only'
}

export class TruckTransportCompanyLockedException extends Exception {
  static status = 409
  static code = 'E_TRUCK_TRANSPORT_COMPANY_LOCKED'
  static message =
    'Truck transport company cannot change while the truck is assigned to a planned or active discharge'
}

export class TruckAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ALREADY_ARCHIVED'
  static message = 'Truck is already archived'
}

export class TruckInUseException extends Exception {
  static status = 409
  static code = 'E_TRUCK_IN_USE'
  static message = 'Truck is used by a planned or active discharge'
}
