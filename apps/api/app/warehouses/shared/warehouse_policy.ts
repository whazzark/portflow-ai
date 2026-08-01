import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type User from '#models/user'

export default class WarehousePolicy extends BasePolicy {
  list(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
