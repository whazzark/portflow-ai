import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'

export default class TransportCompanyPolicy extends BasePolicy {
  list(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }

  listAvailable(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
