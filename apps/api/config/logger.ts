import { defineConfig, targets } from '@adonisjs/core/logger'
import env from '#start/env'

export default defineConfig({
  default: 'app',
  loggers: {
    app: {
      enabled: true,
      name: 'portflow-api',
      level: env.get('LOG_LEVEL'),
      transport: {
        targets: [targets.file({ destination: 1 })],
      },
    },
  },
})
