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

  /**
   * Whether the viewer may correct identities at all. *Which* user they may then correct is a
   * separate decision, owned by UpdateUserIdentityUseCase: an organization admin may use this seam,
   * just not on themselves.
   */
  updateIdentity(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'
  }

  /**
   * Whether the viewer may change anyone's role. Deliberately narrower than `list`: an operations
   * admin consults active users and may not touch a responsibility level, because a viewer who can
   * change a role can grant themselves the organization admin one.
   *
   * Whether the *target* may have their role changed is a separate decision, owned by the guarded
   * write in the repository — the same split `list` describes above.
   */
  changeRole(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'
  }

  /**
   * Narrower than `list`: an operations admin may consult active users but holds no write access to
   * them, so requiring a colleague to renew is an organization admin's alone.
   *
   * *Which* users may then be reset is a separate decision — active, and never the requester —
   * owned by ResetUserPasswordUseCase, exactly as `list` leaves its own narrowing to
   * ListUsersUseCase.
   */
  resetPassword(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE' && user.role === 'ORGANIZATION_ADMIN'
  }
}
