import { inject } from '@adonisjs/core'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

import {
  PasswordResetSelfForbiddenException,
  UserNotActiveException,
  UserNotFoundException,
} from './password_reset_exceptions.ts'

export type ResetUserPasswordInput = {
  targetUserId: string
  /** The organization admin performing the reset, recorded against the event. */
  actorUserId: string
  resetAt: DateTime
}

/**
 * The administrator-side half of the pair `#117` delivered the user-side of: it records the password
 * renewal requirement that the renewal step already enforces and clears.
 *
 * Deliberately no password is generated, changed, or handed over. `CONTEXT.md` defines a password
 * reset as *requiring* an active user to choose a new password — and warns against reading it as
 * password recovery — so the target keeps the credential they already hold, signs in with it
 * normally, and meets the renewal step (FR-010).
 */
@inject()
export default class ResetUserPasswordUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: ResetUserPasswordInput): Promise<User> {
    // Checked before the write, not after: requiring oneself to renew is a self-service password
    // change under another name, and it needs no database round trip to refuse (FR-007).
    //
    // Compared case-insensitively for the reason `DeactivateUserUseCase` records: PostgreSQL matches
    // an upper-cased identifier against the canonical lower-case `uuid` it stores, so a
    // case-sensitive `===` would let the administrator reset their own password.
    if (input.targetUserId.toLowerCase() === input.actorUserId.toLowerCase()) {
      throw new PasswordResetSelfForbiddenException()
    }

    const result = await this.userRepository.requirePasswordRenewal({
      targetUserId: input.targetUserId,
      resetByUserId: input.actorUserId,
      resetAt: input.resetAt,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }
    if (result.kind === 'NOT_ACTIVE') {
      throw new UserNotActiveException()
    }

    return result.user
  }
}
