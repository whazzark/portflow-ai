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
 * A pending user's email address is not correctable: their activation link was handed out under the
 * address recorded at invitation, and this slice issues no replacement. The message is what the
 * workbench shows the administrator as it stands, so it says why and when the address can change.
 */
export class PendingUserEmailChangeException extends Exception {
  static status = 409
  static code = 'E_USER_PENDING_EMAIL_LOCKED'
  static message =
    'This user has not activated their access yet, so their email address cannot be changed. It can be corrected once they have activated their access.'
}

export class InvalidUserIdentityException extends Exception {
  static status = 422
  static code = 'E_USER_IDENTITY_INVALID'
  static message = 'User identity must carry a first name, a last name, and an email address'
}

/**
 * A deactivated user's role is frozen until their access is restored. The message names
 * reactivation because a refusal that only says "no" leaves the administrator guessing which of
 * the four access statuses they are looking at.
 */
export class UserDeactivatedCannotChangeRoleException extends Exception {
  static status = 409
  static code = 'E_USER_DEACTIVATED_CANNOT_CHANGE_ROLE'
  static message = 'Deactivated users cannot have their role changed; reactivate the user first'
}
