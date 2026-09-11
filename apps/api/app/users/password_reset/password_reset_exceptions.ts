import { Exception } from '@adonisjs/core/exceptions'

/**
 * The identifier names nobody. ADR 0003 keeps the MVP single-organization with no scope column, so
 * "a user of another organization" does not exist yet and this is the only not-found case.
 *
 * Distinguishing it from `E_USER_NOT_ACTIVE` discloses nothing: only an organization admin reaches
 * this endpoint, and `#4` already lets them consult every user in every access status.
 */
export class UserNotFoundException extends Exception {
  static status = 404
  static code = 'E_USER_NOT_FOUND'
  static message = 'User not found'
}

/**
 * `409`, the lifecycle-conflict reading `password_renewal_exceptions.ts` established: the request is
 * well formed and the target exists, but the world is in a state that refuses it.
 *
 * A pending user has no password yet and is served by activation link renewal; a deactivated one by
 * reactivation, which records the requirement itself; a cancelled one holds no access to protect.
 */
export class UserNotActiveException extends Exception {
  static status = 409
  static code = 'E_USER_NOT_ACTIVE'
  static message = "Only an active user's password can be reset"
}

/**
 * `422` rather than `409`, the other half of that same split: the refusal is about which target was
 * named, not about a lifecycle state — the same reading as `E_TRUCK_TRANSPORT_COMPANY_INVALID`.
 *
 * An administrator requiring themselves to renew is a self-service password change under another
 * name, and `#117` placed that out of scope (FR-024 there, FR-007 here).
 */
export class PasswordResetSelfForbiddenException extends Exception {
  static status = 422
  static code = 'E_USER_PASSWORD_RESET_SELF'
  static message = 'An administrator cannot reset their own password'
}
