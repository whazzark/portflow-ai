import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

import { passwordRenewalValidator } from '#auth/password_renewal/password_renewal_validator'
import RenewPasswordUseCase from '#auth/password_renewal/renew_password_use_case'
import { presentedRememberedConnectionId } from '#auth/shared/presented_remembered_connection'
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
      keptRememberedConnectionId: await presentedRememberedConnectionId(request),
    })

    return serialize(UserTransformer.transform(renewedUser))
  }
}
