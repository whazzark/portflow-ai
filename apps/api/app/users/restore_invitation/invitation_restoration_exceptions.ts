import { Exception } from '@adonisjs/core/exceptions'

import type { UserAccessStatus } from '#models/user'

/**
 * `409`, the lifecycle-conflict reading every user command uses: the request is well formed and the
 * target exists, but its access status refuses a restoration.
 *
 * The refusal carries the status the target actually holds, because that status is what decides the
 * administrator's next action — an activation link renewal for a pending user, nothing at all for an
 * active one (there is no invitation left to restore), a reactivation for a deactivated one. It is
 * the shape `UserNotPendingException` gives the renewal, rather than the per-status codes GH-12
 * reused: `E_USER_PENDING_INVITATION` and `E_USER_ALREADY_ACTIVATED` carry messages pointing to
 * cancellation and deactivation, which is the wrong advice for a restoration. Naming the status
 * discloses nothing: only an organization admin gets past the policy, and they consult every user in
 * every status anyway.
 *
 * It is also the answer to an administrator naming themselves: they are necessarily active, so they
 * are simply not a cancelled target, and no dedicated self-restoration refusal is needed.
 */
export class UserNotCancelledException extends Exception {
  static status = 409
  static code = 'E_USER_NOT_CANCELLED'
  static message = 'Only a cancelled invitation can be restored'

  readonly meta: { accessStatus: UserAccessStatus }

  constructor(accessStatus: UserAccessStatus) {
    super()
    this.meta = { accessStatus }
  }
}
