import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'

import User from '#models/user'

/**
 * Which remembered connection the request arrived with, so a write replacing the password can spare
 * it. Reading a cookie is HTTP adaptation and belongs to a controller; *which* connections survive
 * is the business rule, and stays in the use cases.
 *
 * Read off the request rather than from the guard, and for a precise reason: the session guard
 * **recycles** the remember token when it uses one — it deletes the presented token and issues a
 * replacement. On a request whose session was restored from the cookie, that has already happened by
 * the time this runs, so `verify()` finds nothing and this returns `null`, revoking every connection
 * including the fresh one. It over-revokes in the safe direction, the session survives it, and only a
 * client whose *first* request is the write can reach it — the web shell always calls `auth.me` first.
 */
export async function presentedRememberedConnectionId(request: HttpContext['request']) {
  const rememberedConnectionCookie = request.encryptedCookie('remember_web')

  if (!rememberedConnectionCookie) {
    return null
  }

  const rememberedConnection = await User.rememberMeTokens.verify(
    new Secret(rememberedConnectionCookie),
  )

  return rememberedConnection ? Number(rememberedConnection.identifier) : null
}
