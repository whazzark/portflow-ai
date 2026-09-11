import { inject } from '@adonisjs/core'

import {
  UserActiveCannotBeRemovedException,
  UserDeactivatedCannotBeRemovedException,
  UserReferencedCannotBeRemovedException,
} from '#users/removal/removal_exceptions'
import UserRepository from '#users/shared/repositories/user_repository'
import { UserNotFoundException } from '#users/shared/user_exceptions'

/**
 * No actor: the removal is untraced, so nobody is recorded against it, and threading the requester
 * through for nothing would suggest a trace that does not exist.
 */
export type RemoveUserInput = {
  id: string
}

/**
 * Owns *which* user may be removed and what each refusal means. Whether the viewer may remove anyone
 * at all is UserPolicy's decision, taken before this runs.
 */
@inject()
export default class RemoveUserUseCase {
  constructor(private userRepository: UserRepository) {}

  async handle(input: RemoveUserInput): Promise<void> {
    const result = await this.userRepository.removeNeverActivated({ id: input.id })

    if (result.kind === 'REMOVED') {
      return
    }

    // Also the answer to a second removal of the same user: nothing of the first is kept, so a user
    // removed a moment ago and one that never existed are the same answer.
    if (result.kind === 'NOT_FOUND') {
      throw new UserNotFoundException()
    }

    if (result.kind === 'REFERENCED') {
      throw new UserReferencedCannotBeRemovedException()
    }

    if (result.accessStatus === 'DEACTIVATED') {
      throw new UserDeactivatedCannotBeRemovedException()
    }

    // `ACTIVE` — including the requester naming themselves. The guarded delete cannot report a
    // pending or cancelled user as not removable, since no transition leads back to either; were it
    // ever to, a refusal is still the honest answer rather than a 500.
    throw new UserActiveCannotBeRemovedException()
  }
}
