import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import UserRepository from '#users/shared/repositories/user_repository'
import {
  DeactivationNoLongerAuthorizedException,
  SelfDeactivationException,
  UserAlreadyDeactivatedException,
  UserCancelledInvitationException,
  UserNotFoundException,
  UserPendingInvitationException,
} from '#users/shared/user_exceptions'

export type DeactivateUserInput = {
  id: string
  deactivatedByUserId: string
  deactivatedAt: DateTime
}

/**
 * Owns *which* user may be deactivated. Whether the viewer may deactivate anyone at all is
 * UserPolicy's decision, taken before this runs — and taken again by the guarded write, against the
 * actor as they stand when it lands, whose verdict this turns back into the policy's refusal.
 */
@inject()
export default class DeactivateUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: DeactivateUserInput) {
    // Refused before the repository is reached: retiring an organization admin's own access
    // requires another organization admin, and no read of the target settles that.
    //
    // Compared case-insensitively, because the identifier and the row it names do not have to agree
    // on case: `users.id` is a real `uuid` column, so PostgreSQL matches an upper-cased identifier
    // against the canonical lower-case row it stores, and the validator accepts both spellings. A
    // case-sensitive `===` would let `0193A2B4-…` walk past this guard and deactivate the very
    // administrator issuing the command.
    if (input.id.toLowerCase() === input.deactivatedByUserId.toLowerCase()) {
      throw new SelfDeactivationException()
    }

    const result = await this.userRepository.deactivateActive({
      id: input.id,
      deactivatedByUserId: input.deactivatedByUserId,
      deactivatedAt: input.deactivatedAt,
    })

    if (result.kind === 'DEACTIVATED') {
      return result.user
    }

    // Ahead of every reason about the target: the actor was demoted or deactivated after the policy
    // let the request through, and is owed that policy's answer, not news about this user.
    if (result.kind === 'ACTOR_NOT_ENTITLED') {
      throw new DeactivationNoLongerAuthorizedException()
    }

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }

    if (result.accessStatus === 'PENDING') {
      throw new UserPendingInvitationException()
    }

    if (result.accessStatus === 'CANCELLED') {
      throw new UserCancelledInvitationException()
    }

    // `DEACTIVATED`, and — now that GH-32 can reactivate mid-request — a row that had moved back
    // to active by the time the guarded write re-read it. Both say the same thing to the caller:
    // someone else changed this user while the request was in flight.
    throw new UserAlreadyDeactivatedException()
  }
}
