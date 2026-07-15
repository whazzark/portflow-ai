import { errors } from '@adonisjs/auth'
import { Secret } from '@adonisjs/core/helpers'
import type { Authenticators } from '@adonisjs/auth/types'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

import User from '#models/user'
import { REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY } from '#auth/shared/remembered_connection'

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
    const rememberedConnectionCookie = ctx.request.encryptedCookie('remember_web')
    const rememberedConnection = rememberedConnectionCookie
      ? await User.rememberMeTokens.verify(new Secret(rememberedConnectionCookie))
      : null

    await ctx.auth.authenticateUsing(options.guards, { loginRoute: this.redirectTo })

    if (ctx.auth.use('web').viaRemember && rememberedConnection) {
      ctx.session.put(
        REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY,
        rememberedConnection.expiresAt.getTime(),
      )
    }

    const rememberedConnectionExpiresAt = ctx.session.get(
      REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY,
    )

    if (
      typeof rememberedConnectionExpiresAt === 'number' &&
      rememberedConnectionExpiresAt <= Date.now()
    ) {
      ctx.session.forget('auth_web')

      throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired user session', {
        guardDriverName: 'session',
      })
    }

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
