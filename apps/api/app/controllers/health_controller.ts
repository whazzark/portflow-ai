import type { HttpContext } from '@adonisjs/core/http'
import { healthChecks } from '#start/health'

export default class HealthChecksController {
  async show(ctx: HttpContext) {
    const report = await healthChecks.run()

    if (!report.isHealthy) {
      return ctx.response.serviceUnavailable(report)
    }

    return ctx.response.ok(report)
  }
}
