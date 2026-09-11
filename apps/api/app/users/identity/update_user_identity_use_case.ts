import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { DateTime } from 'luxon'

import type User from '#models/user'
import ActivationLinkReissuer from '#users/shared/activation_link_reissuer'
import {
  assertValidUserIdentity,
  isSameEmailAddress,
  isSameUserIdentity,
} from '#users/shared/normalize_user_identity'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  ActivationLinkUnavailableException,
  DuplicateUserEmailException,
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
  constructor(
    private userRepository: UserRepository,
    private activationLinkReissuer: ActivationLinkReissuer,
  ) {}

  /**
   * The transaction is owned here rather than by the repository because the correction spans two
   * collaborators: the identity write and, for a pending user reaching a different mailbox, the
   * activation link that must replace the one aimed at the old address. Every refusal below throws
   * inside it, which is what rolls the whole correction back — the behaviour the specification asks
   * for when a link cannot be issued.
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

      // Nothing to apply — and, for a pending user, no mailbox change, so no activation link to
      // replace. A form opened and submitted untouched is a success.
      if (isSameUserIdentity(target, identity)) {
        return target
      }

      if (target.accessStatus === 'PENDING' && !isSameEmailAddress(target.email, identity.email)) {
        const reissue = await this.activationLinkReissuer.reissueForCorrectedEmail({
          user: target,
          email: identity.email,
          client,
        })

        if (reissue.kind === 'UNAVAILABLE') {
          throw new ActivationLinkUnavailableException()
        }
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
