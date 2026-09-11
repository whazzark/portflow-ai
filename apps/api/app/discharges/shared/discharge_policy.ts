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

  /**
   * Every active role may read the detail of every discharge, in every status. The predicate is
   * the list's, but kept apart so that a later slice can narrow one discharge's detail without
   * touching who may browse the collection.
   */
  view(user: User): AuthorizerResponse {
    return user.accessStatus === 'ACTIVE'
  }
}
