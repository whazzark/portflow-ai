import { Exception } from '@adonisjs/core/exceptions'

/**
 * One refusal for every reason a link cannot be used — never issued, malformed, expired, already
 * used, replaced, or belonging to a user who no longer awaits activation. The body is identical in
 * every case on purpose: telling "expired" from "already used" or "cancelled" would tell whoever
 * holds a stale link — a forwarded message, a chat history — what became of the access.
 *
 * `404` because it is the literal truth for every case — no usable link matches — and because the
 * handler ignores it, so a stale link is never reported: being logged is the one thing a secret must
 * not be.
 */
export class ActivationLinkUnusableException extends Exception {
  static status = 404
  static code = 'E_ACTIVATION_LINK_UNUSABLE'
  static message = 'This activation link cannot be used'
}

/**
 * The browser already holds a session — typically the inviting administrator opening the link they
 * just copied. Completing the acceptance would let them choose the invited person's password, so it
 * is refused, and neither the link nor the open session is touched.
 */
export class InvitationAcceptanceSessionOpenException extends Exception {
  static status = 409
  static code = 'E_INVITATION_ACCEPTANCE_SESSION_OPEN'
  static message = 'Log out before activating this access'
}

/**
 * The activation committed, then opening the session failed. Only the request that activated can
 * know this, so answering it here discloses nothing to anyone else; a retry would meet the uniform
 * unusable refusal instead.
 *
 * `500`, and therefore reported: the person's access is fine, but a session that cannot be opened
 * is a server fault an operator should see.
 */
export class InvitationAcceptedSessionNotOpenedException extends Exception {
  static status = 500
  static code = 'E_INVITATION_ACCEPTED_SESSION_NOT_OPENED'
  static message = 'Your access is active. Log in with your new password'
}
