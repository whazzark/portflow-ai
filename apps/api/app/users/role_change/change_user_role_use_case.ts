import { inject } from '@adonisjs/core'

import type { UserRole } from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'
import {
  UserDeactivatedCannotChangeRoleException,
  UserNotFoundException,
} from '#users/shared/user_exceptions'

export type ChangeUserRoleInput = {
  userId: string
  role: UserRole
}

@inject()
export default class ChangeUserRoleUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * Whether the *viewer* may change a role at all is `UserPolicy.changeRole`'s decision, taken
   * before this runs. What is decided here is the target's eligibility, and it is decided from the
   * guarded write's outcome rather than from a read — so a user deactivated between the moment an
   * administrator opened the record and the moment they confirmed is still refused.
   */
  async handle(input: ChangeUserRoleInput) {
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

    return result.user
  }
}
