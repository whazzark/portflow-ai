import { Exception } from '@adonisjs/core/exceptions'

/**
 * Raised when a session that owes nothing submits a renewal, and equally when a concurrent renewal
 * cleared the requirement first — one guarded `UPDATE` matching zero rows produces both.
 */
export class PasswordRenewalNotRequiredException extends Exception {
  static status = 409
  static code = 'E_PASSWORD_RENEWAL_NOT_REQUIRED'
  static message = 'No password renewal is required for this account'
}

/**
 * `422` rather than `409`: the refusal is about the submitted value, not a lifecycle conflict —
 * the same reading as `E_TRUCK_TRANSPORT_COMPANY_INVALID`.
 */
export class PasswordUnchangedException extends Exception {
  static status = 422
  static code = 'E_PASSWORD_RENEWAL_UNCHANGED'
  static message = 'New password must be different from the current one'
}

/**
 * The confinement. `403`, never `401`: the session is valid and must not be terminated, and the
 * web's `isUnauthorizedError` matches only `401` — a `401` here would sign the user out of the
 * session they need in order to fix the very thing being refused.
 */
export class PasswordRenewalRequiredException extends Exception {
  static status = 403
  static code = 'E_PASSWORD_RENEWAL_REQUIRED'
  static message = 'Choose a new password before using the application'
}
