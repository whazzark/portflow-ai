import { inject } from '@adonisjs/core'

import type { UserRole } from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  LastActiveOrganizationAdminException,
  SelfRoleChangeException,
  UserDeactivatedCannotChangeRoleException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

export type ChangeUserRoleInput = {
  userId: string
  role: UserRole
  /** The organization admin asking — the session's user. Refused if it names the target. */
  requestedByUserId: string
}

@inject()
export default class ChangeUserRoleUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * Whether the *viewer* may change a role at all is `UserPolicy.changeRole`'s decision, taken
   * before this runs. Which *target* may have theirs changed is decided here: the requester never,
   * which the request alone settles; the others from the guarded write's outcome rather than from a
   * read — so a user deactivated between the moment an administrator opened the record and the
   * moment they confirmed is still refused.
   *
   * The same holds for the last active organization admin, decided by the locked write when it
   * lands. That is also why the requester is not re-checked there: an administrator demoted or
   * deactivated while their request was in flight no longer counts among the admins who remain, so
   * a demotion that would leave nobody is refused all the same.
   */
  async handle(input: ChangeUserRoleInput) {
    // Refused before the repository is reached: nothing stored decides it, and no lock is worth
    // taking for a request that names its own sender.
    //
    // Compared case-insensitively, for the reason `DeactivateUserUseCase` records: `users.id` is a
    // real `uuid` column, so PostgreSQL matches an upper-cased identifier against the canonical
    // lower-case row, and the validator accepts both spellings. A case-sensitive `===` would let
    // `0193A2B4-…` walk past this guard and demote the very administrator issuing the command.
    if (input.userId.toLowerCase() === input.requestedByUserId.toLowerCase()) {
      throw new SelfRoleChangeException()
    }

    const result = await this.userRepository.changeRole({
      userId: input.userId,
      role: input.role,
    })

    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }
    if (result.kind === 'DEACTIVATED') {
      throw new UserDeactivatedCannotChangeRoleException()
    }
    if (result.kind === 'LAST_ACTIVE_ORGANIZATION_ADMIN') {
      throw new LastActiveOrganizationAdminException()
    }

    return result.user
  }
}
