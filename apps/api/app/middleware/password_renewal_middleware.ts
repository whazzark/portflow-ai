import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import { PasswordRenewalRequiredException } from '#auth/password_renewal/password_renewal_exceptions'

/**
 * Refuses every request from a session whose user still owes a password renewal.
 *
 * The user comes from the session guard, which loads the row from the database on every request —
 * so no second query is needed, and a requirement recorded seconds ago by an administrator is seen
 * at once (FR-005, US2-7).
 *
 * `403`, never `401`: the session is valid and must not be terminated, and the web's
 * `isUnauthorizedError` matches only `401`, which would sign the user out of the very session they
 * need in order to clear the requirement.
 *
 * Which routes this guards is decided in `start/routes.ts` by where a route is declared, not by a
 * list of names here — a rename would otherwise be a silent security change.
 */
export default class PasswordRenewalMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.use('web').getUserOrFail()

    if (user.passwordRenewalRequiredAt !== null) {
      throw new PasswordRenewalRequiredException()
    }

    return next()
  }
}
