import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'

import type User from '#models/user'
import { isEligibleShiftResponsible } from '#users/shared/shift_responsible_eligibility'

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

  /**
   * Preparing a discharge is open to the roles that may be accountable for its shifts: an operations
   * lead prepares the work they will lead, alongside the admins who hold every lead permission.
   */
  create(user: User): AuthorizerResponse {
    return isEligibleShiftResponsible(user)
  }

  /**
   * Correcting a planned discharge's identity or its product lots. Whether the discharge is still
   * planned is the use case's decision, not the policy's: it depends on the discharge, and has to be
   * read under the discharge's lock.
   */
  update(user: User): AuthorizerResponse {
    return isEligibleShiftResponsible(user)
  }

  /**
   * Confirming a discharge's start. The same roles prepare and start a discharge today, but the start
   * is its own ability so that a later slice can narrow who may put a discharge into operation
   * without touching who may prepare one. Whether the discharge is still planned, and whether it can
   * start, are the use case's decisions, read under its locks.
   */
  start(user: User): AuthorizerResponse {
    return isEligibleShiftResponsible(user)
  }
}
