import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'
import { ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * HTTP status codes that should not be reported.
   * These are typically client errors that don't indicate
   * problems with your application.
   */
  protected ignoreStatuses = [400, 401, 403, 404, 409, 422]

  /**
   * Error codes that should not be reported.
   * These are application-specific error codes for
   * expected error conditions.
   */
  protected ignoreCodes = ['E_VALIDATION_ERROR', 'E_UNAUTHORIZED_ACCESS']

  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof Exception) {
      return ctx.response
        .status(error.status)
        .send({ errors: [{ code: error.code, message: error.message }] })
    }

    return await super.handle(error, ctx)
  }
}
