import type { DateTime } from 'luxon'

import type User from '#models/user'
import type { UserAccessStatus, UserRole } from '#models/user'

export type CreateUserCommand = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  invitedAt?: DateTime
  invitedByUserId?: string
}

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

export default abstract class UserRepository {
  abstract create(command: CreateUserCommand): Promise<User>
  abstract findByEmail(email: string): Promise<User | null>

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
}
