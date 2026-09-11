import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'

import type User from '#models/user'
import type { UserRole } from '#models/user'
import ActivationLinkIssuer from '#users/shared/activation_link_issuer'
import { normalizeUserEmail, normalizeUserName } from '#users/shared/normalize_user'
import UserRepository from '#users/shared/repositories/user_repository'

import { EmailAlreadyInUseException } from './invitation_exceptions.ts'

export type InviteUserInput = {
  firstName: string
  lastName: string
  email: string
  role: UserRole
  /** The organization admin granting the access, recorded as responsible for the invitation. */
  invitedBy: User
}

export type UserInvitation = {
  user: User
  /** Returned to the caller once. Only its digest survives this call. */
  activationLink: { url: string; expiresAt: DateTime }
}

@inject()
export default class InviteUserUseCase {
  constructor(
    private userRepository: UserRepository,
    private activationLinkIssuer: ActivationLinkIssuer,
  ) {}

  async handle(input: InviteUserInput): Promise<UserInvitation> {
    const email = normalizeUserEmail(input.email)
    // Read first, for the message: the refusal has to name the access status the existing user
    // holds, and only a read can supply it. The index below is what makes the refusal *true* when
    // two invitations race.
    const alreadyHolding = await this.userRepository.findByEmail(email)

    if (alreadyHolding) {
      throw new EmailAlreadyInUseException(alreadyHolding.accessStatus)
    }

    const activationLink = this.activationLinkIssuer.issue()

    const result = await this.userRepository.invite({
      firstName: normalizeUserName(input.firstName),
      lastName: normalizeUserName(input.lastName),
      email,
      role: input.role,
      invitedAt: DateTime.now(),
      invitedByUserId: input.invitedBy.id,
      activationTokenHash: activationLink.hash,
      activationTokenExpiresAt: activationLink.expiresAt,
    })

    if (result.kind === 'DUPLICATE_EMAIL') {
      // Lost the race against another invitation of the same email. The winner's row is re-read so
      // the loser's refusal reads exactly like one decided before the write.
      const winner = await this.userRepository.findByEmail(email)

      throw new EmailAlreadyInUseException(winner?.accessStatus ?? 'PENDING')
    }

    // The projection names the administrator responsible for the invitation, and this call already
    // holds them: hydrating the relation here spares the read that loading it would cost.
    result.user.$setRelated('invitedBy', input.invitedBy)

    return {
      user: result.user,
      activationLink: { url: activationLink.url, expiresAt: activationLink.expiresAt },
    }
  }
}
