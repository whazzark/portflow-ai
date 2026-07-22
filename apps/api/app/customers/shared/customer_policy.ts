import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'

export default class CustomerPolicy extends BasePolicy {
  create(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  list(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  view(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }

  update(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  listAvailable(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
