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
