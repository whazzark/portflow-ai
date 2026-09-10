import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import UserRepository from '#users/shared/repositories/user_repository'
import {
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
 * UserPolicy's decision, taken before this runs.
 */
@inject()
export default class DeactivateUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: DeactivateUserInput) {
    // Refused before the repository is reached: retiring an organization admin's own access
    // requires another organization admin, and no read of the target settles that.
    if (input.id === input.deactivatedByUserId) {
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

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }

    if (result.accessStatus === 'PENDING') {
      throw new UserPendingInvitationException()
    }

    if (result.accessStatus === 'CANCELLED') {
      throw new UserCancelledInvitationException()
    }

    // `DEACTIVATED`, and — only once GH-32 can reactivate mid-request — a row that had moved back
    // to active by the time the guarded write re-read it. Both say the same thing to the caller:
    // someone else changed this user while the request was in flight.
    throw new UserAlreadyDeactivatedException()
  }
}
