import { Exception } from '@adonisjs/core/exceptions'

export class TransportCompanyNotFoundException extends Exception {
  static status = 404
  static code = 'E_TRANSPORT_COMPANY_NOT_FOUND'
  static message = 'Transport company not found'
}

export class DuplicateTransportCompanyNameException extends Exception {
  static status = 409
  static code = 'E_TRANSPORT_COMPANY_NAME_CONFLICT'
  static message = 'Transport company name is already in use'
}

export class ArchivedTransportCompanyReadOnlyException extends Exception {
  static status = 409
  static code = 'E_TRANSPORT_COMPANY_ARCHIVED'
  static message = 'Archived transport companies are read-only'
}

export class TransportCompanyAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_TRANSPORT_COMPANY_ALREADY_ARCHIVED'
  static message = 'Transport company is already archived'
}

export class TransportCompanyHasAvailableTrucksException extends Exception {
  static status = 409
  static code = 'E_TRANSPORT_COMPANY_HAS_AVAILABLE_TRUCKS'
  static message = 'Transport company still provides available trucks'
}

export class TransportCompanyAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_TRANSPORT_COMPANY_ALREADY_AVAILABLE'
  static message = 'Transport company is already available'
}

export class InvalidTransportCompanyContactPhoneException extends Exception {
  static status = 422
  static code = 'E_TRANSPORT_COMPANY_CONTACT_PHONE_INVALID'
  static message = 'Transport company contact phone number is invalid'
}

export class InvalidTransportCompanyContactEmailException extends Exception {
  static status = 422
  static code = 'E_TRANSPORT_COMPANY_CONTACT_EMAIL_INVALID'
  static message = 'Transport company contact email address is invalid'
}
