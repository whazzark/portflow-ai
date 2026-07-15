import { errors } from '@adonisjs/auth'
import type { Authenticators } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import User from '#models/user'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
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
    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })

    const authenticatedUser = ctx.auth.use('web').getUserOrFail()
    const user = await User.find(authenticatedUser.id)

    if (user?.accessStatus !== 'ACTIVE') {
      throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired user session', {
        guardDriverName: 'session',
      })
    }

    return next()
  }
}
