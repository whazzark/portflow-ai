import { Exception } from '@adonisjs/core/exceptions'

import type { UserAccessStatus } from '#models/user'

/**
 * One person, one access. The refusal carries the access status of the user already holding the
 * email, because that status is what decides the administrator's next action — renewing an
 * activation link, restoring a cancelled invitation, or reactivating a deactivated user. An
 * organization admin consults every status anyway, so naming it discloses nothing they cannot read.
 */
export class EmailAlreadyInUseException extends Exception {
  static status = 409
  static code = 'E_USER_EMAIL_CONFLICT'
  static message = 'Email is already in use'

  readonly meta: { accessStatus: UserAccessStatus }

  constructor(accessStatus: UserAccessStatus) {
    super()
    this.meta = { accessStatus }
  }
}
