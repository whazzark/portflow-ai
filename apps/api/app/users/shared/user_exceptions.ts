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

/**
 * The administrator was entitled when the request arrived and no longer is when the deactivation
 * would take effect — deactivated or demoted by a change that landed in between. It renders exactly
 * what `UserPolicy.deactivate`'s denial renders (Bouncer's `AuthorizationException`), rather than a
 * code of its own: only someone who has already lost the entitlement can ever receive it, and they
 * are owed the same answer, disclosing nothing about the target, as if the policy had said no.
 */
export class DeactivationNoLongerAuthorizedException extends Exception {
  static status = 403
  static code = 'E_AUTHORIZATION_FAILURE'
  static message = 'Access denied'
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

/**
 * The target has already activated their access, so there is no invitation left to withdraw — the
 * access that exists now is retired by deactivation, which the message names. Filed here because
 * that target is refused by more than the cancellation, though only the cancellation uses this code:
 * the removal names its own refusal (`E_USER_ACTIVE_CANNOT_BE_REMOVED`), and the restoration names
 * the status it found (`E_USER_NOT_CANCELLED`), since pointing to deactivation is the wrong advice
 * for either.
 */
export class UserAlreadyActivatedException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_ACTIVATED'
  static message = 'User has already activated their access; deactivate them instead'
}

export class UserAlreadyDeactivatedException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_DEACTIVATED'
  static message = 'User is already deactivated'
}

/**
 * The reactivation's counterpart of `UserAlreadyDeactivatedException`: the target holds access right
 * now — someone else reactivated them first, or the administrator named themselves. Not
 * `UserAlreadyActivatedException`, which says the invitation is behind this user and tells the
 * administrator to deactivate them instead: advice that is wrong here.
 */
export class UserAlreadyActiveException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_ACTIVE'
  static message = 'User is already active'
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

/**
 * A 409 for the reason `SelfDeactivationException` gives: the administrator may change roles, and
 * what is refused is this one target. Refused whatever role is asked for — the one already held
 * included — so no request naming oneself is ever answered as a success. Nobody's responsibility
 * level rests on their own say, and no administrator can demote themselves by accident.
 */
export class SelfRoleChangeException extends Exception {
  static status = 409
  static code = 'E_USER_SELF_ROLE_CHANGE'
  static message = 'Your own role can only be changed by another organization admin'
}

/**
 * The organization would be left with nobody able to administer its users. Worded about that rule
 * rather than about role changes, so that the deactivation guard (GH-21) can refuse with this very
 * exception; and it names neither the admins who remain nor how many — the refusal states the rule,
 * which holds whatever the count, and discloses nothing about anyone else.
 *
 * It only ever reaches an administrator who lost that role or their access in the same collision:
 * an active organization admin asking would themselves be the admin who remains. That is why it
 * does not say what to do next — they usually no longer can.
 */
export class LastActiveOrganizationAdminException extends Exception {
  static status = 409
  static code = 'E_USER_LAST_ACTIVE_ORGANIZATION_ADMIN'
  static message = 'The organization must keep at least one active organization admin'
}
