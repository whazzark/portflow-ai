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

/**
 * 403 rather than 409: an organization admin may use this seam, just not on themselves. The
 * administrator seam is not the one for that target, which is an authorization-shaped statement.
 */
export class SelfIdentityUpdateException extends Exception {
  static status = 403
  static code = 'E_USER_IDENTITY_SELF_UPDATE'
  static message = 'Your own identity is updated through the self-service path, not this one'
}

export class DuplicateUserEmailException extends Exception {
  static status = 409
  static code = 'E_USER_EMAIL_CONFLICT'
  static message = 'Email address is already used by another user'
}

/**
 * Raised when a pending user's email address changes and no activation link can be issued to the
 * corrected address. Failing the whole correction is deliberate: the alternative would leave an
 * outstanding link aimed at a mailbox the organization no longer recognizes as that user's.
 */
export class ActivationLinkUnavailableException extends Exception {
  static status = 409
  static code = 'E_USER_ACTIVATION_LINK_UNAVAILABLE'
  static message =
    'The email address of a user who has not activated their access cannot be changed until an activation link can be issued to the new address'
}

export class InvalidUserIdentityException extends Exception {
  static status = 422
  static code = 'E_USER_IDENTITY_INVALID'
  static message = 'User identity must carry a first name, a last name, and an email address'
}
