import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import { digestActivationSecret } from '#users/shared/activation_link_issuer'
import UserRepository from '#users/shared/repositories/user_repository'

import {
  ActivationLinkUnusableException,
  InvitationAcceptanceSessionOpenException,
} from './invitation_acceptance_exceptions.ts'

export type AcceptInvitationInput = {
  token: string
  password: string
  /**
   * The user of the session the request arrived with, resolved by the controller exactly as
   * `AuthMiddleware` would resolve it. Reading the session is HTTP adaptation; refusing to accept
   * from someone else's session is the business rule, and it lives here.
   */
  signedInUserId: string | null
  acceptedAt: DateTime
}

@inject()
export default class AcceptInvitationUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * The order is the contract. The session is refused before the link is even looked at, so a
   * logged-in browser learns nothing about any link. An unusable link is refused before the
   * password is hashed, so a stale link never costs an scrypt run. And the hash is computed before
   * the write, never inside it: scrypt at `cost: 16384` is deliberately slow, and holding a write
   * open across it is the one way this endpoint could affect unrelated traffic.
   */
  async handle(input: AcceptInvitationInput): Promise<User> {
    if (input.signedInUserId !== null) {
      throw new InvitationAcceptanceSessionOpenException()
    }

    const tokenHash = digestActivationSecret(input.token)

    if (
      !(await this.userRepository.findPendingByActivationTokenHash(tokenHash, input.acceptedAt))
    ) {
      throw new ActivationLinkUnusableException()
    }

    const hashedPassword = await hash.make(input.password)

    const result = await this.userRepository.acceptInvitation({
      tokenHash,
      hashedPassword,
      acceptedAt: input.acceptedAt,
    })

    // Reached by the loser of a race, and by a link that expired while the password was hashed.
    if (result.kind === 'UNUSABLE') {
      throw new ActivationLinkUnusableException()
    }

    return result.user
  }
}
