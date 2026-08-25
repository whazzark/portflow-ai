import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'

export default class TruckPolicy extends BasePolicy {
  list(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  listAvailable(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }

  create(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  update(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  archive(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  reactivate(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }
}
