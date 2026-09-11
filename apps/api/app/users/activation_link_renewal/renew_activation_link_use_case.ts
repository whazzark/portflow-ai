import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import ActivationLinkIssuer from '#users/shared/activation_link_issuer'
import UserRepository from '#users/shared/repositories/user_repository'
import { UserNotFoundException } from '#users/shared/user_exceptions'

import { UserNotPendingException } from './activation_link_renewal_exceptions.ts'

export type RenewActivationLinkInput = {
  targetUserId: string
  /** The organization admin performing the renewal, recorded against the event. */
  actorUserId: string
  renewedAt: DateTime
}

/**
 * The same shape as `UserInvitation`, on purpose: the workbench hands out a renewed link through
 * the very outcome it hands out an invited one, so there is one way of doing it.
 */
export type ActivationLinkRenewal = {
  user: User
  /** Returned to the caller once. Only its digest survives this call. */
  activationLink: { url: string; expiresAt: DateTime }
}

/**
 * Replaces a pending user's activation link without creating or restoring an invitation — the
 * `CONTEXT.md` meaning of *User Activation Link Renewal*. It is the only recovery GH-7 leaves for a
 * link that was never passed on, was lost after its single presentation, or has expired.
 */
@inject()
export default class RenewActivationLinkUseCase {
  constructor(
    private userRepository: UserRepository,
    private activationLinkIssuer: ActivationLinkIssuer,
  ) {}

  async handle(input: RenewActivationLinkInput): Promise<ActivationLinkRenewal> {
    // Issued before the write so no randomness or hashing runs inside the transaction. A refused
    // renewal simply discards it: the secret was never stored, so it opens nothing.
    const activationLink = this.activationLinkIssuer.issue()

    const result = await this.userRepository.renewActivationLink({
      targetUserId: input.targetUserId,
      renewedByUserId: input.actorUserId,
      renewedAt: input.renewedAt,
      activationTokenHash: activationLink.hash,
      activationTokenExpiresAt: activationLink.expiresAt,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }
    // No self check precedes this, deliberately: the requester is an active organization admin —
    // the policy admits nobody else — so naming themselves is simply naming a user who is not
    // pending, and it is refused here like any other.
    if (result.kind === 'NOT_PENDING') {
      throw new UserNotPendingException(result.accessStatus)
    }

    return {
      user: result.user,
      activationLink: { url: activationLink.url, expiresAt: activationLink.expiresAt },
    }
  }
}
