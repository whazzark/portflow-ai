import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import LoginUserUseCase from '#auth/login/login_use_case'
import { loginValidator } from '#auth/login/login_validator'
import UserTransformer from '#users/shared/transformers/user_transformer'

@inject()
export default class LoginController {
  constructor(private loginUserUseCase: LoginUserUseCase) {}

  async store({ request, auth, serialize }: HttpContext) {
    const payload = await request.validateUsing(loginValidator)

    const user = await this.loginUserUseCase.handle(payload)

    await auth.use('web').login(user)

    return serialize(UserTransformer.transform(user))
  }
}
