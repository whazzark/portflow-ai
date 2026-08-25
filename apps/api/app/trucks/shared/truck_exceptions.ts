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

export class TruckAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ALREADY_AVAILABLE'
  static message = 'Truck is already available'
}

/**
 * Raised by both paths that can turn a non-available truck into an available one: reactivating an
 * archived truck (`#226`) and returning a suspended one to service (`#253`). Neither may produce an
 * available truck under an archived transport company.
 *
 * The message names company reactivation alone. Reassigning the truck to another company would also
 * resolve it in principle, but it cannot be done from either state: reassignment goes through
 * `updateAvailable`, which is guarded by `WHERE status = 'AVAILABLE'`.
 */
export class TruckTransportCompanyArchivedException extends Exception {
  static status = 409
  static code = 'E_TRUCK_TRANSPORT_COMPANY_ARCHIVED'
  static message =
    'Truck transport company is archived; reactivate the transport company before making this truck available again'
}

export class TruckAlreadySuspendedException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ALREADY_SUSPENDED'
  static message = 'Truck is already suspended'
}

export class TruckArchivedCannotSuspendException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ARCHIVED_CANNOT_SUSPEND'
  static message = 'Archived trucks cannot be suspended; reactivate the truck first'
}

export class SuspendedTruckReadOnlyException extends Exception {
  static status = 409
  static code = 'E_TRUCK_SUSPENDED'
  static message = 'Truck is suspended; return it to service first'
}

export class TruckArchivedCannotReturnException extends Exception {
  static status = 409
  static code = 'E_TRUCK_ARCHIVED_CANNOT_RETURN'
  static message = 'Archived trucks cannot be returned to service; reactivate the truck instead'
}
