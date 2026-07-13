import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#users/shared/transformers/user_transformer'

export default class MeController {
  async show({ auth, serialize }: HttpContext) {
    const user = auth.use('web').getUserOrFail()

    return serialize(UserTransformer.transform(user))
  }
}
