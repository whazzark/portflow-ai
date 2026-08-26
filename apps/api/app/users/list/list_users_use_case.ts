import { inject } from '@adonisjs/core'

import type User from '#models/user'
import UserRepository from '#users/shared/repositories/user_repository'

@inject()
export default class ListUsersUseCase {
  constructor(private userRepository: UserRepository) {}

  /**
   * Which users the viewer may consult. An organization admin reads the whole organization with its
   * access history; every other authorized viewer reads the active users only. Decided from the
   * viewer alone, never from request input, so the scope cannot be widened by the client.
   */
  handle(viewer: User) {
    return viewer.role === 'ORGANIZATION_ADMIN'
      ? this.userRepository.list()
      : this.userRepository.listActive()
  }
}
