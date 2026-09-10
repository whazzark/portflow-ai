import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'

export default class DischargePolicy extends BasePolicy {
  /**
   * Browsing discharges is open to every active role. Closed discharges are operational history
   * every role may read, not administration context, so unlike the site references there is no
   * administrator-only collection to separate here.
   */
  list(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
