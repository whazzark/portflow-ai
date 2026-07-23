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

export class CustomerInUseException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_IN_USE'
  static message = 'Customer is used by a planned or active discharge'
}

export class CustomerAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_ALREADY_ARCHIVED'
  static message = 'Customer is already archived'
}

export class CustomerAlreadyAvailableException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_ALREADY_AVAILABLE'
  static message = 'Customer is already available'
}

export class BulkCustomerArchiveBlockedException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_BULK_ARCHIVE_BLOCKED'
  static message = 'One or more customers could not be archived'

  declare meta: { blockedCustomers: unknown[] }

  constructor(blockedCustomers: unknown[]) {
    super()
    this.meta = { blockedCustomers }
  }
}

export class BulkCustomerReactivationBlockedException extends Exception {
  static status = 409
  static code = 'E_CUSTOMER_BULK_REACTIVATION_BLOCKED'
  static message = 'One or more customers could not be reactivated'

  declare meta: { blockedCustomers: unknown[] }

  constructor(blockedCustomers: unknown[]) {
    super()
    this.meta = { blockedCustomers }
  }
}
