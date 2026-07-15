import type { HttpContext } from '@adonisjs/core/http'

export default class LogoutController {
  async destroy({ auth, response }: HttpContext): Promise<void> {
    await auth.use('web').logout()

    response.status(204)

    return
  }
}
