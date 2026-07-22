import { Exception } from '@adonisjs/core/exceptions'

export class CustomerNotFoundException extends Exception {
  static status = 404
  static code = 'E_CUSTOMER_NOT_FOUND'
  static message = 'Customer not found'
}

export class DuplicateCustomerCodeException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_CODE_CONFLICT'
  static message = 'Customer code is already in use'
}

export class DuplicateCustomerCompanyNameException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_COMPANY_NAME_CONFLICT'
  static message = 'Customer company name is already in use'
}

export class ArchivedCustomerReadOnlyException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_ARCHIVED'
  static message = 'Archived customers are read-only'
}

export class ForbiddenCustomerAccessException extends Exception {
  static status = 403
  static code = 'E_FORBIDDEN_ACCESS'
  static message = 'You are not allowed to administer customers'
}

export class CustomerUpdateFieldsException extends Exception {
  static status = 422
  static code = 'E_CUSTOMER_UPDATE_FIELDS_REQUIRED'
  static message = 'At least one customer field must be provided'
}
