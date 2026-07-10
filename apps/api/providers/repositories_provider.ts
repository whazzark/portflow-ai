import type { ApplicationService } from '@adonisjs/core/types'

import LucidUserRepository from '#users/shared/repositories/lucid_user_repository'
import UserRepository from '#users/shared/repositories/user_repository'

export default class RepositoriesProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.bind(UserRepository, () => {
      return this.app.container.make(LucidUserRepository)
    })
  }
}
