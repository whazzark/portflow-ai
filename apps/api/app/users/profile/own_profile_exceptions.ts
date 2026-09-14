import { Exception } from '@adonisjs/core/exceptions'

/**
 * The address a user signs in with does not move on the strength of an open session alone.
 *
 * `422`, never `401`: the session is valid and must survive the refusal, and the web's
 * `isUnauthorizedError` matches only `401` — it would sign the user out of the form they are
 * filling in. Nor `403`, which reads as "you may not be here". What is refused is the submission's
 * content, the reading `E_PASSWORD_RENEWAL_UNCHANGED` already has.
 */
export class CurrentPasswordRequiredException extends Exception {
  static status = 422
  static code = 'E_CURRENT_PASSWORD_REQUIRED'
  static message = 'Enter your current password to change your email address.'
}

/**
 * `422` for the reasons `CurrentPasswordRequiredException` gives. Shared by the two writes that ask
 * for the current password — moving the sign-in address, and replacing the password itself.
 */
export class CurrentPasswordIncorrectException extends Exception {
  static status = 422
  static code = 'E_CURRENT_PASSWORD_INCORRECT'
  static message = 'The current password is incorrect.'
}

/**
 * A password change that changes nothing. Its own code rather than
 * `E_PASSWORD_RENEWAL_UNCHANGED`: that one names a renewal an administrator required, while this is
 * a change the user chose to make.
 */
export class NewPasswordUnchangedException extends Exception {
  static status = 422
  static code = 'E_PASSWORD_UNCHANGED'
  static message = 'New password must be different from the current one.'
}

/**
 * The signed-in user stopped being active — deactivated, or gone — between the session guard's read
 * and the lock this update takes. It answers exactly what `middleware.auth()` answers one request
 * later, so the interface treats both the same way: the session has ended.
 */
export class OwnProfileUnavailableException extends Exception {
  static status = 401
  static code = 'E_UNAUTHORIZED_ACCESS'
  static message = 'Unauthorized access'
}
