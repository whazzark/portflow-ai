import { Exception } from '@adonisjs/core/exceptions'

export class InvalidSiteReferenceNameException extends Exception {
  static status = 422
  static code = 'E_SITE_REFERENCE_NAME_INVALID'
  static message = 'Site reference name must not be empty'
}

export class InvalidSiteReferenceCoordinatesException extends Exception {
  static status = 422
  static code = 'E_SITE_REFERENCE_COORDINATES_INVALID'
  static message = 'Site reference coordinates are invalid'
}

export class InvalidSiteReferenceCodeException extends Exception {
  static status = 422
  static code = 'E_SITE_REFERENCE_CODE_INVALID'
  static message = 'Site reference code must not be empty'
}
