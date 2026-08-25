import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type User from '#models/user'

export default class WarehousePolicy extends BasePolicy {
  create(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  list(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }

  archive(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }

  reactivate(user: User): AuthorizerResponse {
    return user.role === 'ORGANIZATION_ADMIN' || user.role === 'OPERATIONS_ADMIN'
  }
}
