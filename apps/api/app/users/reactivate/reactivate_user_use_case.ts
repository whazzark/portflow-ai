import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  UserAlreadyActiveException,
  UserCancelledInvitationException,
  UserNotFoundException,
  UserPendingInvitationException,
} from '#users/shared/user_exceptions'

export type ReactivateUserInput = {
  id: string
  reactivatedByUserId: string
  reactivatedAt: DateTime
}

/**
 * Owns *which* user may be reactivated — a deactivated one, and no other. Whether the viewer may
 * reactivate anyone at all is UserPolicy's decision, taken before this runs.
 *
 * Deliberately no password is generated, changed, or handed over (CLR-001). `CONTEXT.md` defines a
 * reactivation as restoring access *while requiring a new password*: the user signs in with the
 * password they held before the deactivation and meets the renewal step, exactly as after a reset.
 */
@inject()
export default class ReactivateUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: ReactivateUserInput): Promise<User> {
    const result = await this.userRepository.reactivateDeactivated({
      id: input.id,
      reactivatedByUserId: input.reactivatedByUserId,
      reactivatedAt: input.reactivatedAt,
    })

    if (result.kind === 'REACTIVATED') {
      return result.user
    }

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }

    // The two status exceptions are the deactivation's: their codes name the target's state, which
    // is the same whichever command meets it. Their static messages advise the deactivation's
    // alternative, so each is thrown with the action that applies instead of a reactivation.
    if (result.accessStatus === 'PENDING') {
      throw new UserPendingInvitationException(
        'User has never activated their access; renew their activation link instead',
      )
    }

    if (result.accessStatus === 'CANCELLED') {
      throw new UserCancelledInvitationException(
        'User invitation was cancelled before activation; restore the invitation instead',
      )
    }

    // `ACTIVE`: someone else reactivated this user first, or the administrator named themselves —
    // a deactivated administrator holds no session, so no dedicated self refusal is needed. And
    // `DEACTIVATED`: a row that had been reactivated and retired again by the time the guarded write
    // re-read it. Both say the same thing to the caller, as they do in `DeactivateUserUseCase`:
    // someone else changed this user while the request was in flight, and the workbench the refusal
    // returns to reads the status afresh.
    throw new UserAlreadyActiveException()
  }
}
