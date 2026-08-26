import { inject } from '@adonisjs/core'

import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

export type UserConsultation = {
  users: User[]
  /**
   * Whether the rows carry their lifecycle actors, and so whether the access history may be
   * projected. Decided here, alongside the read it describes, so the projection can never claim a
   * history the query did not load.
   */
  includeAccessHistory: boolean
}

@inject()
export default class ListUsersUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * Which users the viewer may consult. An organization admin reads the whole organization with its
   * access history; every other authorized viewer reads the active users only. Decided from the
   * viewer alone, never from request input, so the scope cannot be widened by the client.
   */
  async handle(viewer: User): Promise<UserConsultation> {
    if (viewer.role === 'ORGANIZATION_ADMIN') {
      return { users: await this.userRepository.list(), includeAccessHistory: true }
    }

    return { users: await this.userRepository.listActive(), includeAccessHistory: false }
  }
}
