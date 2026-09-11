import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import {
  assertValidUserIdentity,
  isSameEmailAddress,
  isSameUserIdentity,
} from '#users/shared/normalize_user_identity'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  DuplicateUserEmailException,
  PendingUserEmailChangeException,
  SelfIdentityUpdateException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

export type UpdateUserIdentityInput = {
  targetUserId: string
  /** The administrator asking. Never the target: this seam corrects *another* user. */
  requestedByUserId: string
  firstName: string
  lastName: string
  email: string
  changedAt: DateTime
}

@inject()
export default class UpdateUserIdentityUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * The transaction is owned here rather than by the repository because every decision below is
   * taken against the target read under its row lock, and the write that follows must land before
   * anyone else's: a refusal throws inside it, and nothing is written.
   */
  handle(input: UpdateUserIdentityInput): Promise<User> {
    const identity = assertValidUserIdentity({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    })

    return db.transaction(async (client) => {
      const target = await this.userRepository.findByIdForUpdate(input.targetUserId, client)

      if (!target) {
        throw new UserNotFoundException()
      }
      if (target.id === input.requestedByUserId) {
        throw new SelfIdentityUpdateException()
      }

      // Nothing to apply. A form opened and submitted untouched is a success.
      if (isSameUserIdentity(target, identity)) {
        return target
      }

      // A pending user's activation link was handed out under the address recorded at invitation,
      // and this slice issues no replacement: their name can be corrected, their mailbox cannot.
      // Re-casing the same address is not a mailbox change, so it goes through.
      if (target.accessStatus === 'PENDING' && !isSameEmailAddress(target.email, identity.email)) {
        throw new PendingUserEmailChangeException()
      }

      const result = await this.userRepository.applyIdentity({
        id: target.id,
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
        changedAt: input.changedAt,
        client,
      })

      if (result.kind === 'NOT_FOUND') {
        throw new UserNotFoundException()
      }
      if (result.kind === 'EMAIL_TAKEN') {
        throw new DuplicateUserEmailException()
      }

      return result.user
    })
  }
}
