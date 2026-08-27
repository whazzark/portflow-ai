import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'

import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

import {
  PasswordRenewalNotRequiredException,
  PasswordUnchangedException,
} from './password_renewal_exceptions.ts'

export type RenewPasswordInput = {
  user: User
  password: string
  /**
   * Which remembered connection survives the renewal. Resolved from the request cookie by the
   * controller — reading a cookie is HTTP adaptation, while *which* tokens survive is the business
   * rule that lives here and stays unit-testable without an HTTP context.
   */
  keptRememberedConnectionId: number | null
}

@inject()
export default class RenewPasswordUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: RenewPasswordInput): Promise<User> {
    // No current-password field is asked for — the session already proves the user holds it — so
    // sameness is checked against the stored hash instead (FR-011). The null guard is for a state
    // an active user is never in: a PENDING user has no password, and only active users get here.
    if (input.user.password && (await hash.verify(input.user.password, input.password))) {
      throw new PasswordUnchangedException()
    }

    // Hashed before the write, never inside it: scrypt at `cost: 16384` is deliberately slow, and
    // holding a write open across it is the one way this endpoint could affect unrelated traffic.
    const hashedPassword = await hash.make(input.password)

    const result = await this.userRepository.renewPassword({
      userId: input.user.id,
      hashedPassword,
      keptRememberedConnectionId: input.keptRememberedConnectionId,
    })

    if (result === 'NOT_REQUIRED') {
      throw new PasswordRenewalNotRequiredException()
    }

    // The guarded `UPDATE` wrote straight to the row, so the in-memory instance the caller holds is
    // brought back in step rather than re-read.
    input.user.password = hashedPassword
    input.user.passwordRenewalRequiredAt = null

    return input.user
  }
}
