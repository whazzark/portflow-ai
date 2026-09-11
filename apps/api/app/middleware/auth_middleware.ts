import type { Authenticators } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { authenticateOpenSession } from '#auth/shared/open_session'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 *
 * What counts as an open session is defined in `open_session.ts`, shared with the invitation
 * acceptance, which must answer the same question without refusing the request.
 */
export default class AuthMiddleware {
  /**
   * The URL to redirect to, when authentication fails
   */
  redirectTo = '/login'

  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {},
  ) {
    await authenticateOpenSession(ctx, { guards: options.guards, loginRoute: this.redirectTo })

    return next()
  }
}
