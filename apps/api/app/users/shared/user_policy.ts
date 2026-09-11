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

  /**
   * Whether the viewer may grant access to the organization. Unlike consultation, invitation has a
   * single permitted role, so the whole decision fits here: an operations admin consults active
   * users, they do not create them.
   */
  invite(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'
  }

  /**
   * Whether the viewer may deactivate users at all. *Which* user they may then deactivate is a
   * separate decision, owned by DeactivateUserUseCase — the same split `list` makes above, and for
   * the same reason: every Bouncer denial surfaces as one `E_AUTHORIZATION_FAILURE`, so a rule
   * expressed here is a rule the administrator can never be told the reason for.
   */
  deactivate(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'
  }
}
