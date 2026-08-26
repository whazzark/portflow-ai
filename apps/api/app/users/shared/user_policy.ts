import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'

export default class UserPolicy extends BasePolicy {
  /**
   * Whether the viewer may consult the organization's users at all. Which users they may then see
   * is a separate decision, owned by ListUsersUseCase.
   */
  list(user: User): AuthorizerResponse {
    return (
      user.accessStatus === 'ACTIVE' &&
      (user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN')
    )
  }
}
