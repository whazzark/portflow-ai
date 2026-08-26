import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import ListUsersUseCase from '#users/list/list_users_use_case'
import UserTransformer from '#users/shared/transformers/user_transformer'
import UserPolicy from '#users/shared/user_policy'

@inject()
export default class UsersController {
  constructor(private listUsersUseCase: ListUsersUseCase) {}

  async index({ auth, bouncer, serialize }: HttpContext) {
    await bouncer.with(UserPolicy).authorize('list')

    const viewer = auth.getUserOrFail()
    const { users, includeAccessHistory } = await this.listUsersUseCase.handle(viewer)

    return serialize(
      UserTransformer.transform(users, { includeAccessHistory }).useVariant('toAdministration'),
    )
  }
}
