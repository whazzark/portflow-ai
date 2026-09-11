import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type { UserAccessStatus } from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  UserAlreadyActivatedException,
  UserAlreadyDeactivatedException,
  UserCancelledInvitationException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

export type CancelUserInvitationInput = {
  id: string
  cancelledByUserId: string
  cancelledAt: DateTime
  comment?: string | null
}

/**
 * Owns *which* invitation may be cancelled — a pending user's, and no other. Whether the viewer may
 * cancel invitations at all is UserPolicy's decision, taken before this runs.
 *
 * No self-cancellation rule: the policy only admits an active administrator, so their own access is
 * already ineligible, and the guarded write refuses it like any other activated user.
 */
@inject()
export default class CancelUserInvitationUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: CancelUserInvitationInput) {
    const result = await this.userRepository.cancelPendingInvitation({
      id: input.id,
      cancelledByUserId: input.cancelledByUserId,
      cancelledAt: input.cancelledAt,
      // A blank comment is no comment, the rule every lifecycle comment in the product follows.
      comment: input.comment?.trim() || null,
    })

    if (result.kind === 'CANCELLED') {
      return result.user
    }

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }

    return this.refuseNotPending(result.accessStatus)
  }

  /**
   * One refusal per status the guarded write can observe, each naming what applies instead. The
   * `never` branch makes a fifth access status a type error here rather than a silent 500.
   */
  private refuseNotPending(accessStatus: UserAccessStatus): never {
    switch (accessStatus) {
      case 'ACTIVE':
        throw new UserAlreadyActivatedException()
      case 'DEACTIVATED':
        throw new UserAlreadyDeactivatedException()
      // `PENDING` only once restoration exists: an invitation that was cancelled when the guard ran
      // and restored by the time the refusal was classified. Both say the same thing to the caller
      // — someone else changed this invitation while the request was in flight — which is what the
      // cancelled refusal tells them, and the refreshed collection shows them where it stands now.
      case 'CANCELLED':
      case 'PENDING':
        throw new UserCancelledInvitationException()
      default: {
        const unhandled: never = accessStatus

        throw new Error(`Unhandled access status: ${String(unhandled)}`)
      }
    }
  }
}
