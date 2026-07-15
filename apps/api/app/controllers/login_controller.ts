import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import LoginUserUseCase from '#auth/login/login_use_case'
import { loginValidator } from '#auth/login/login_validator'
import {
  REMEMBERED_CONNECTION_DURATION_MS,
  REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY,
} from '#auth/shared/remembered_connection'
import UserTransformer from '#users/shared/transformers/user_transformer'

@inject()
export default class LoginController {
  constructor(private loginUserUseCase: LoginUserUseCase) {}

  async store({ request, auth, serialize, session }: HttpContext) {
    const payload = await request.validateUsing(loginValidator)

    const user = await this.loginUserUseCase.handle(payload)

    await auth.use('web').login(user, payload.rememberMe)

    if (payload.rememberMe) {
      session.put(
        REMEMBERED_CONNECTION_EXPIRES_AT_SESSION_KEY,
        Date.now() + REMEMBERED_CONNECTION_DURATION_MS,
      )
    }

    return serialize(UserTransformer.transform(user))
  }
}
