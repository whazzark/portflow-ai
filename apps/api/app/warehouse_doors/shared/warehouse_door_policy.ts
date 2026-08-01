import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type User from '#models/user'

export default class WarehouseDoorPolicy extends BasePolicy {
  listAvailable(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
