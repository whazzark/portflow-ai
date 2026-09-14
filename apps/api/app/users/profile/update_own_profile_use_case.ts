import { inject } from '@adonisjs/core'
import hash from '@adonisjs/core/services/hash'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import { PasswordRenewalRequiredException } from '#auth/password_renewal/password_renewal_exceptions'
import type User from '#models/user'
import {
  assertValidUserIdentity,
  isSameEmailAddress,
  isSameUserIdentity,
} from '#users/shared/normalize_user_identity'
import UserRepository from '#users/shared/repositories/user_repository'
import { DuplicateUserEmailException } from '#users/shared/user_exceptions'

import {
  CurrentPasswordIncorrectException,
  CurrentPasswordRequiredException,
  OwnProfileUnavailableException,
} from './own_profile_exceptions.ts'

export type UpdateOwnProfileInput = {
  /** The session's user, as the guard loaded it for this request. Always the target. */
  user: User
  firstName: string
  lastName: string
  email: string
  /** Required only when the address changes. Verified, never kept. */
  currentPassword?: string
  changedAt: DateTime
}

/**
 * The self-service counterpart of `UpdateUserIdentityUseCase`: the same identity rules, the same
 * locked read and conditional write, under a different authorization story. The two stay separate
 * because they decide different things — the administrator's refuses a self-target and a pending
 * user's mailbox, this one re-confirms the password before the sign-in identifier moves.
 */
@inject()
export default class UpdateOwnProfileUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * The transaction is owned here for the reason the administrator's use case gives: every decision
   * is taken against the row read under its lock, and the write that follows must land before
   * anyone else's.
   */
  async handle(input: UpdateOwnProfileInput): Promise<User> {
    const identity = assertValidUserIdentity({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    })

    // Verified before the transaction, never inside it: scrypt at `cost: 16384` is deliberately
    // slow, and holding the row lock across it is the one way this write could stall others. It is
    // also what keeps a conflicting address from being reported to anyone who does not know the
    // password — the conflict is only found by the write below.
    const verifiedPasswordHash = await this.verifyPasswordForAddressChange(input, identity.email)

    return db.transaction(async (client) => {
      const locked = await this.userRepository.findByIdForUpdate(input.user.id, client)

      // The auth middleware refuses a user who is no longer active, one request later. What is left
      // is the window inside this one, between the session guard's read and this lock: a
      // deactivation landing there is answered as the session having ended, which is what it is.
      // "Gone" is the same case — only a never-activated user can be removed.
      if (locked?.accessStatus !== 'ACTIVE') {
        throw new OwnProfileUnavailableException()
      }

      // The renewal gate read the same row one step earlier, with the same window: an
      // administrator's reset landing in it leaves the password hash untouched, so the check below
      // on the hash cannot see it. Answered exactly as the gate answers it.
      if (locked.passwordRenewalRequiredAt !== null) {
        throw new PasswordRenewalRequiredException()
      }

      // Nothing to apply. A form opened and submitted untouched is a success.
      if (isSameUserIdentity(locked, identity)) {
        return locked
      }

      // The verification above was taken against the row the session guard read. If the address
      // moves against the row as it stands now — an administrator changed it in between — or the
      // password is no longer the one verified, that verification does not cover this write.
      if (
        !isSameEmailAddress(locked.email, identity.email) &&
        (verifiedPasswordHash === null || locked.password !== verifiedPasswordHash)
      ) {
        throw new CurrentPasswordRequiredException()
      }

      const result = await this.userRepository.applyIdentity({
        id: locked.id,
        firstName: identity.firstName,
        lastName: identity.lastName,
        email: identity.email,
        changedAt: input.changedAt,
        client,
      })

      // Found only here, after the password was verified: the address being held by someone else is
      // never reported to a submission that could not prove it is the user's own.
      if (result.kind === 'EMAIL_TAKEN') {
        throw new DuplicateUserEmailException()
      }
      if (result.kind === 'NOT_FOUND') {
        throw new OwnProfileUnavailableException()
      }

      return result.user
    })
  }

  /**
   * The password hash that was verified, or `null` when the address does not move and none was
   * needed. A name is not a credential; the address a user signs in with is.
   *
   * A missing password is refused before any hashing: no secret is involved, so there is nothing
   * whose timing could be read.
   */
  private async verifyPasswordForAddressChange(
    input: UpdateOwnProfileInput,
    email: string,
  ): Promise<string | null> {
    if (isSameEmailAddress(input.user.email, email)) {
      return null
    }

    if (!input.currentPassword) {
      throw new CurrentPasswordRequiredException()
    }

    // The null guard is for a state an active user is never in: only a pending user has no
    // password, and pending users cannot sign in.
    const storedHash = input.user.password

    if (!storedHash || !(await hash.verify(storedHash, input.currentPassword))) {
      throw new CurrentPasswordIncorrectException()
    }

    return storedHash
  }
}
