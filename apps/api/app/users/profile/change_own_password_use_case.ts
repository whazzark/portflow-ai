import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import { PasswordRenewalRequiredException } from '#auth/password_renewal/password_renewal_exceptions'
import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

import {
  CurrentPasswordIncorrectException,
  NewPasswordUnchangedException,
  OwnProfileUnavailableException,
} from './own_profile_exceptions.ts'

export type ChangeOwnPasswordInput = {
  /** The session's user, as the guard loaded it for this request. Always the target. */
  user: User
  /** Verified, never kept: an open session is not a credential. */
  currentPassword: string
  password: string
  /**
   * Which remembered connection survives the change. Resolved from the request cookie by the
   * controller — reading a cookie is HTTP adaptation, while *which* connections survive is the
   * business rule that lives here and stays unit-testable without an HTTP context.
   */
  keptRememberedConnectionId: number | null
  changedAt: DateTime
}

/**
 * The user replacing their own password, having proved they hold the current one.
 *
 * Distinct from `RenewPasswordUseCase`, which serves the renewal an administrator imposed: that one
 * asks for no current password, because the requirement is what stands in its place, and it is
 * reachable precisely while this seam is not.
 */
@inject()
export default class ChangeOwnPasswordUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: ChangeOwnPasswordInput): Promise<User> {
    // Both scrypt calls run before the transaction: at `cost: 16384` each is deliberately slow, and
    // holding a row lock across them is the one way this endpoint could affect unrelated traffic.
    // The null guard is for a state an active user is never in: only a pending user has no password.
    const verifiedPasswordHash = input.user.password

    if (
      !verifiedPasswordHash ||
      !(await hash.verify(verifiedPasswordHash, input.currentPassword))
    ) {
      throw new CurrentPasswordIncorrectException()
    }

    if (await hash.verify(verifiedPasswordHash, input.password)) {
      throw new NewPasswordUnchangedException()
    }

    const hashedPassword = await hash.make(input.password)

    return db.transaction(async (client) => {
      const locked = await this.userRepository.findByIdForUpdate(input.user.id, client)

      // The same two windows the identity update closes, for the same reason: the session guard and
      // the renewal gate read this row one step earlier, and a deactivation or an administrator's
      // reset landing in between must not be written over.
      if (locked?.accessStatus !== 'ACTIVE') {
        throw new OwnProfileUnavailableException()
      }
      if (locked.passwordRenewalRequiredAt !== null) {
        throw new PasswordRenewalRequiredException()
      }

      // The password moved since it was verified — another tab, or a reset. The verification above
      // does not cover this write, and a password nobody proved they hold is not replaced.
      if (locked.password !== verifiedPasswordHash) {
        throw new CurrentPasswordIncorrectException()
      }

      return this.userRepository.applyOwnPassword({
        id: locked.id,
        hashedPassword,
        changedAt: input.changedAt,
        keptRememberedConnectionId: input.keptRememberedConnectionId,
        client,
      })
    })
  }
}
