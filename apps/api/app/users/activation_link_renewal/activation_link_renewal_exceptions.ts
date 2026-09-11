import { Exception } from '@adonisjs/core/exceptions'

import type { UserAccessStatus } from '#models/user'

/**
 * `409`, the lifecycle-conflict reading every user command uses: the request is well formed and the
 * target exists, but its access status refuses a renewal.
 *
 * The refusal carries the status the target actually holds, because that status is what decides the
 * administrator's next action — a password reset for an active user, a reactivation for a
 * deactivated one, an invitation restoration for a cancelled one — the shape
 * `EmailAlreadyInUseException` already uses for the same purpose. Naming it discloses nothing: only
 * an organization admin gets past the policy, and they consult every user in every status anyway.
 *
 * It is also the answer to an administrator naming themselves: they are necessarily active, so they
 * are simply not a pending target, and no dedicated self-renewal refusal is needed.
 */
export class UserNotPendingException extends Exception {
  static status = 409
  static code = 'E_USER_NOT_PENDING'
  static message = "Only a pending user's activation link can be renewed"

  readonly meta: { accessStatus: UserAccessStatus }

  constructor(accessStatus: UserAccessStatus) {
    super()
    this.meta = { accessStatus }
  }
}
