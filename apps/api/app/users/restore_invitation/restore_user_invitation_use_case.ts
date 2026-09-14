import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import ActivationLinkIssuer from '#users/shared/activation_link_issuer'
import UserRepository from '#users/shared/repositories/user_repository'
import { UserNotFoundException } from '#users/shared/user_exceptions'

import { UserNotCancelledException } from './invitation_restoration_exceptions.ts'

export type RestoreUserInvitationInput = {
  id: string
  /** The organization admin performing the restoration, recorded against the event. */
  restoredByUserId: string
  restoredAt: DateTime
  comment?: string | null
}

/**
 * The same shape as `UserInvitation` and `ActivationLinkRenewal`, on purpose: the workbench hands
 * out a restored link through the very outcome it hands out an invited or renewed one, so there is
 * one way of doing it.
 */
export type InvitationRestoration = {
  user: User
  /** Returned to the caller once. Only its digest survives this call. */
  activationLink: { url: string; expiresAt: DateTime }
}

/**
 * Makes a cancelled user invitation pending again — the `CONTEXT.md` meaning of *User Invitation
 * Restoration* — with a new activation link. It is neither a new invitation (the original one is
 * kept, as is the cancellation it reverses) nor a renewal (the user changes access status). Whether
 * the viewer may restore invitations at all is UserPolicy's decision, taken before this runs.
 */
@inject()
export default class RestoreUserInvitationUseCase {
  constructor(
    private userRepository: UserRepository,
    private activationLinkIssuer: ActivationLinkIssuer,
  ) {}

  async handle(input: RestoreUserInvitationInput): Promise<InvitationRestoration> {
    // Issued before the write so no randomness or hashing runs inside the transaction. A refused
    // restoration simply discards it: the secret was never stored, so it opens nothing.
    const activationLink = this.activationLinkIssuer.issue()

    const result = await this.userRepository.restoreCancelledInvitation({
      id: input.id,
      restoredByUserId: input.restoredByUserId,
      restoredAt: input.restoredAt,
      // A blank comment is no comment, the rule every lifecycle comment in the product follows.
      comment: input.comment?.trim() || null,
      activationTokenHash: activationLink.hash,
      activationTokenExpiresAt: activationLink.expiresAt,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }
    // No self check precedes this, deliberately: the requester is an active organization admin —
    // the policy admits nobody else — so naming themselves is simply naming a user who is not
    // cancelled, and it is refused here like any other.
    if (result.kind === 'NOT_CANCELLED') {
      throw new UserNotCancelledException(result.accessStatus)
    }

    return {
      user: result.user,
      activationLink: { url: activationLink.url, expiresAt: activationLink.expiresAt },
    }
  }
}
