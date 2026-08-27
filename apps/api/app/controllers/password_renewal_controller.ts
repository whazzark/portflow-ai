import { inject } from '@adonisjs/core'
import { Secret } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'

import { passwordRenewalValidator } from '#auth/password_renewal/password_renewal_validator'
import RenewPasswordUseCase from '#auth/password_renewal/renew_password_use_case'
import User from '#models/user'
import UserTransformer from '#users/shared/transformers/user_transformer'

@inject()
export default class PasswordRenewalController {
  constructor(private renewPasswordUseCase: RenewPasswordUseCase) {}

  async store({ request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(passwordRenewalValidator)

    const user = auth.use('web').getUserOrFail()

    const renewedUser = await this.renewPasswordUseCase.handle({
      user,
      password: payload.password,
      keptRememberedConnectionId: await this.presentedRememberedConnectionId(request),
    })

    return serialize(UserTransformer.transform(renewedUser))
  }

  /**
   * Which remembered connection the request arrived with, so the renewal can spare it. Reading a
   * cookie is HTTP adaptation and belongs here; *which* connections survive is the business rule
   * and belongs to the use case, which is what keeps that rule testable without an HTTP context.
   *
   * Read off the request, exactly as `AuthMiddleware` does, and for the same reason: the session
   * guard **recycles** the remember token when it uses one — it deletes the presented token and
   * issues a replacement. On a request whose session was restored from the cookie, that has already
   * happened by the time this runs, so `verify()` finds nothing and this returns `null`, revoking
   * every connection including the fresh one. It over-revokes in the safe direction, the session
   * survives it, and only a client whose *first* request is the renewal can reach it — the web
   * shell always calls `auth.me` first.
   */
  private async presentedRememberedConnectionId(request: HttpContext['request']) {
    const rememberedConnectionCookie = request.encryptedCookie('remember_web')

    if (!rememberedConnectionCookie) {
      return null
    }

    const rememberedConnection = await User.rememberMeTokens.verify(
      new Secret(rememberedConnectionCookie),
    )

    return rememberedConnection ? Number(rememberedConnection.identifier) : null
  }
}
