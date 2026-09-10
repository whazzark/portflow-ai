import { Exception } from '@adonisjs/core/exceptions'

export class UserNotFoundException extends Exception {
  static status = 404
  static code = 'E_USER_NOT_FOUND'
  static message = 'User not found'
}

/**
 * Refused as a conflict rather than an authorization failure: the administrator *is* entitled to
 * deactivate users, and what is refused is this particular target. A 403 would land in the bucket
 * the interface treats as "you may not be here", and would make the refusal an administrator is
 * most likely to trigger by accident read as a permissions problem.
 */
export class SelfDeactivationException extends Exception {
  static status = 409
  static code = 'E_USER_SELF_DEACTIVATION'
  static message = 'An organization admin cannot deactivate their own access'
}

export class UserPendingInvitationException extends Exception {
  static status = 409
  static code = 'E_USER_PENDING_INVITATION'
  static message = 'User has never activated their access; cancel the invitation instead'
}

export class UserCancelledInvitationException extends Exception {
  static status = 409
  static code = 'E_USER_CANCELLED_INVITATION'
  static message = 'User invitation was cancelled before activation'
}

export class UserAlreadyDeactivatedException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_DEACTIVATED'
  static message = 'User is already deactivated'
}
