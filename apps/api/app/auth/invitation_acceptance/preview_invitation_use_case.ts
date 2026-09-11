import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import { digestActivationSecret } from '#users/shared/activation_link_issuer'
import UserRepository from '#users/shared/repositories/user_repository'

import { ActivationLinkUnusableException } from './invitation_acceptance_exceptions.ts'

export type PreviewInvitationInput = {
  token: string
  now: DateTime
}

/**
 * Whose access a presented link activates. Changes nothing, and does not care whether the browser
 * holds a session: the screen shows the answer next to the signed-in user either way.
 */
@inject()
export default class PreviewInvitationUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: PreviewInvitationInput): Promise<User> {
    const user = await this.userRepository.findPendingByActivationTokenHash(
      digestActivationSecret(input.token),
      input.now,
    )

    if (!user) {
      throw new ActivationLinkUnusableException()
    }

    return user
  }
}
