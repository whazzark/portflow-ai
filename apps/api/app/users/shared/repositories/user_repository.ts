import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import type { UserAccessStatus, UserRole } from '#models/user'
import type UserActivationToken from '#models/user_activation_token'

export type CreateUserCommand = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  invitedAt?: DateTime
  invitedByUserId?: string
}

export type InviteUserCommand = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  invitedAt: DateTime
  invitedByUserId: string
  /** The digest of the issued activation link, and the instant it stops being usable. */
  activationTokenHash: string
  activationTokenExpiresAt: DateTime
}

/**
 * A typed outcome rather than an exception: the repository owns the write, the use case owns which
 * refusal the caller sees.
 */
export type InviteUserResult =
  | { kind: 'CREATED'; user: User; activationToken: UserActivationToken }
  | { kind: 'DUPLICATE_EMAIL' }

export type RenewPasswordCommand = {
  userId: string
  /**
   * Already hashed by the caller: scrypt at `cost: 16384` is deliberately slow and must never run
   * inside a write.
   */
  hashedPassword: string
  /**
   * The remembered connection the request presented, which survives the renewal. A number because
   * `remember_me_tokens.id` is an `increments` column, and a string bound against it would never
   * match on SQLite.
   *
   * `null` when the request carries no remembered connection — or when the session was restored
   * from the cookie on this very request, in which case the guard has already recycled the token
   * and every one of the user's remembered connections is revoked instead. Over-revoking is the
   * safe direction here.
   */
  keptRememberedConnectionId: number | null
}

export type RenewPasswordResult = 'RENEWED' | 'NOT_REQUIRED'

export type DeactivateUserCommand = {
  id: string
  deactivatedByUserId: string
  deactivatedAt: DateTime
}

/**
 * What the guarded write observed, never what the caller should be told: selecting the business
 * exception is the use case's job.
 *
 * `NOT_ACTIVE` carries the status the row actually had, which is the only thing that distinguishes
 * a pending invitation from a cancelled one from a user someone else deactivated first.
 */
export type DeactivateUserResult =
  | { kind: 'DEACTIVATED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_ACTIVE'; accessStatus: UserAccessStatus }

export type CancelPendingInvitationCommand = {
  id: string
  cancelledByUserId: string
  cancelledAt: DateTime
  /** Already normalized by the use case: trimmed, and `null` when blank. */
  comment: string | null
}

/**
 * What the guarded write observed, never what the caller should be told — the same split as
 * `DeactivateUserResult`, and for the same reason: `NOT_PENDING` carries the status the row actually
 * had, which is the only thing that tells an activated user from a deactivated one from an invitation
 * someone else cancelled first.
 */
export type CancelPendingInvitationResult =
  | { kind: 'CANCELLED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_PENDING'; accessStatus: UserAccessStatus }

export type ApplyUserIdentityCommand = {
  id: string
  firstName: string
  lastName: string
  email: string
  changedAt: DateTime
  /**
   * The correction's transaction, opened by the use case: the identity and the activation link a
   * pending user's corrected address needs are one indivisible effect.
   */
  client: TransactionClientContract
}

export type ApplyUserIdentityResult =
  | { kind: 'UPDATED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'EMAIL_TAKEN' }

export type ChangeUserRoleCommand = {
  userId: string
  role: UserRole
}

/**
 * The three outcomes of the guarded write, deliberately free of HTTP: choosing a status code is the
 * use case's job, not this layer's.
 */
export type ChangeUserRoleResult =
  | { kind: 'CHANGED'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'DEACTIVATED' }

export type RemoveUserCommand = {
  id: string
}

/**
 * What the guarded delete observed, never what the caller should be told.
 *
 * `REMOVED` carries no user: there is nothing left to project, and nothing about the removed user
 * is kept. `NOT_REMOVABLE` carries the status the row actually had, which is what distinguishes an
 * active user, whose access is withdrawn by deactivation, from a deactivated one, who is kept.
 */
export type RemoveUserResult =
  | { kind: 'REMOVED' }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_REMOVABLE'; accessStatus: UserAccessStatus }
  | { kind: 'REFERENCED' }

export type RequirePasswordRenewalCommand = {
  targetUserId: string
  /** The organization admin performing the reset, recorded against the event. */
  resetByUserId: string
  resetAt: DateTime
}

/**
 * `NOT_FOUND` and `NOT_ACTIVE` are distinguished because FR-006 wants a refusal naming the current
 * access status and FR-014 wants every refusal distinguishable — see `password_reset_exceptions.ts`
 * for why telling them apart discloses nothing to the only role that reaches this write.
 */
export type RequirePasswordRenewalResult =
  | { kind: 'RESET'; user: User }
  | { kind: 'NOT_FOUND' }
  | { kind: 'NOT_ACTIVE' }

export type AcceptInvitationCommand = {
  /** The digest of the presented activation secret, never the secret itself. */
  tokenHash: string
  /**
   * Already hashed by the caller: scrypt at `cost: 16384` is deliberately slow and must never run
   * inside a write.
   */
  hashedPassword: string
  acceptedAt: DateTime
}

/**
 * `UNUSABLE` covers every reason the link could not be consumed — none matched, it expired, its user
 * is no longer pending, or a concurrent acceptance consumed it first. The caller never needs to know
 * which: every one of them is the same refusal.
 */
export type AcceptInvitationResult = { kind: 'ACCEPTED'; user: User } | { kind: 'UNUSABLE' }

export default abstract class UserRepository {
  abstract create(command: CreateUserCommand): Promise<User>

  /**
   * Creates a pending user together with its activation token, or refuses because the email is
   * already held. Both rows commit together: a user without a link, or a link without a user, is a
   * half-granted access.
   */
  abstract invite(command: InviteUserCommand): Promise<InviteUserResult>
  abstract findByEmail(email: string): Promise<User | null>

  /**
   * The pending user a presented activation link opens, or `null` when the link is unusable. A link
   * is usable when an activation token matches the digest, has not expired at `now`, and belongs to
   * a user still `PENDING` — the three conditions under which acceptance may consume it.
   */
  abstract findPendingByActivationTokenHash(hash: string, now: DateTime): Promise<User | null>

  /**
   * Consumes the activation link and activates its user, or refuses because the link is unusable.
   * Both effects commit together: a consumed link with a pending user, or an active user whose link
   * still works, is a half-accepted invitation. The guarded delete of the token is the concurrency
   * control, so two acceptances racing on one link resolve to exactly one.
   */
  abstract acceptInvitation(command: AcceptInvitationCommand): Promise<AcceptInvitationResult>

  /**
   * Every user of the organization, with the administrator responsible for each recorded lifecycle
   * event resolved. Consulted only by viewers allowed to see the access history.
   */
  abstract list(): Promise<User[]>

  /**
   * The active users only, without lifecycle actors: a responsible administrator is itself a user
   * the restricted viewer may not consult.
   */
  abstract listActive(): Promise<User[]>

  abstract renewPassword(command: RenewPasswordCommand): Promise<RenewPasswordResult>

  /**
   * Moves one user from active to deactivated and revokes every remembered connection they hold.
   * The transition is guarded on the row still being active, so concurrent attempts resolve to
   * exactly one deactivation.
   */
  abstract deactivateActive(command: DeactivateUserCommand): Promise<DeactivateUserResult>

  /**
   * Moves one user from pending to cancelled, recording the cancellation event and its comment, and
   * deletes that user's activation token. The transition is guarded on the row still being pending,
   * so concurrent attempts resolve to exactly one cancellation; the status change and the end of the
   * link commit together or not at all.
   */
  abstract cancelPendingInvitation(
    command: CancelPendingInvitationCommand,
  ): Promise<CancelPendingInvitationResult>

  /**
   * The target user, read under a row lock inside the caller's transaction, so that the identity a
   * correction is decided against is the one it actually replaces and two concurrent corrections
   * cannot interleave into a mixed identity. Carries the access history, like every read the
   * administration projection serializes.
   *
   * Returns `null` when no such user exists — the documented not-found contract of a lookup.
   */
  abstract findByIdForUpdate(id: string, client: TransactionClientContract): Promise<User | null>

  /**
   * Writes the corrected identity. Conditional on the address still being
   * free: `EMAIL_TAKEN` covers both a conflict seen before the write and one that appears between
   * the check and the write, since `users_email_unique` is the authority on either.
   */
  abstract applyIdentity(command: ApplyUserIdentityCommand): Promise<ApplyUserIdentityResult>

  /**
   * Sets one user's role, refusing a deactivated target. Submitting the role the user already holds
   * is a `CHANGED` outcome with an unchanged row: there is nothing to report as a failure, and no
   * history that a no-op could pollute.
   */
  abstract changeRole(command: ChangeUserRoleCommand): Promise<ChangeUserRoleResult>

  /**
   * Permanently deletes one user whose access was never activated — pending or cancelled — together
   * with their activation link. Guarded on the row still being in one of those two statuses, so the
   * decision is taken against the user as they are when the delete runs, and two concurrent removals
   * resolve to one `REMOVED` and one `NOT_FOUND`.
   */
  abstract removeNeverActivated(command: RemoveUserCommand): Promise<RemoveUserResult>

  /**
   * Records the password renewal requirement against an active user, together with the reset event,
   * and revokes every remembered connection that user holds.
   *
   * The counterpart of `renewPassword`, one row over: that one clears the requirement and spares the
   * connection it was performed from, this one records it and spares none — the administrator is not
   * the target, so there is no connection to spare.
   */
  abstract requirePasswordRenewal(
    command: RequirePasswordRenewalCommand,
  ): Promise<RequirePasswordRenewalResult>
}
