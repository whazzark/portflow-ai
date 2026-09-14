import { errors } from '@adonisjs/auth'
import type { Authenticators } from '@adonisjs/auth/types'
import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import { REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY } from '#auth/shared/remembered_connection'
import {
  matchesSessionReactivation,
  REACTIVATION_SESSION_KEY,
  recordSessionReactivation,
} from '#auth/shared/session_reactivation'
import User from '#models/user'

export type AuthenticateOpenSessionOptions = {
  guards?: (keyof Authenticators)[]
  loginRoute: string
}

/**
 * What "this request carries an open session" means in this application, in one place: the guard
 * authenticates it — restoring it from a remembered connection if need be — the remembered
 * connection it came from has not outlived its fixed expiry, its user is still active, and it was
 * opened under that user's latest reactivation (`session_reactivation.ts`).
 *
 * Throws `E_UNAUTHORIZED_ACCESS` on any failure, with the guard's own message when no session
 * exists at all and "Invalid or expired user session" when one exists but no longer counts.
 * `AuthMiddleware` relies on exactly these refusals.
 */
export async function authenticateOpenSession(
  ctx: HttpContext,
  options: AuthenticateOpenSessionOptions,
): Promise<User> {
  const rememberedConnectionCookie = ctx.request.encryptedCookie('remember_web')
  const rememberedConnection = rememberedConnectionCookie
    ? await User.rememberMeTokens.verify(new Secret(rememberedConnectionCookie))
    : null

  await ctx.auth.authenticateUsing(options.guards, { loginRoute: options.loginRoute })

  const restoredOnThisRequest = ctx.auth.use('web').viaRemember

  if (restoredOnThisRequest && rememberedConnection) {
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

  // A session restored from a remembered connection just came into being, so it is stamped with the
  // reactivation it opens under — safe because the reactivation revokes every remembered connection
  // made before it, so none that survives can predate it.
  if (restoredOnThisRequest) {
    recordSessionReactivation(ctx.session, user)
  }

  // Forgotten, not merely refused: the browser then holds no user at all, and signing in again
  // opens a session under the current reactivation.
  if (!matchesSessionReactivation(ctx.session, user)) {
    ctx.session.forget('auth_web')
    ctx.session.forget(REACTIVATION_SESSION_KEY)

    throw new errors.E_UNAUTHORIZED_ACCESS('Invalid or expired user session', {
      guardDriverName: 'session',
    })
  }

  return user
}

/**
 * The same question for a public route that must not refuse a visitor: the user of the open
 * session, or `null` when `AuthMiddleware` would have refused the request.
 *
 * Deliberately not `auth.check()`, which accepts a deactivated user's leftover cookie or a
 * remembered connection past its fixed expiry. The web decides what to show from `auth.me`, which
 * goes through `AuthMiddleware`; a looser rule here would refuse, as "logged in", a browser the web
 * rightly treats as logged out — a screen the person could never complete.
 */
export async function resolveOpenSessionUser(ctx: HttpContext): Promise<User | null> {
  try {
    return await authenticateOpenSession(ctx, { loginRoute: '/login' })
  } catch (error) {
    if (error instanceof errors.E_UNAUTHORIZED_ACCESS) {
      return null
    }

    throw error
  }
}
