import { randomUUID } from 'node:crypto'
import { defineConfig } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

export default {
  appKey: env.get('APP_KEY'),
  http: defineConfig({
    generateRequestId: true,
    createRequestId: () => randomUUID(),
    allowMethodSpoofing: false,
    useAsyncLocalStorage: false,
    cookie: {
      domain: '',
      path: '/',
      maxAge: '2h',
      httpOnly: true,
      secure: app.inProduction,
      sameSite: 'lax',
    },
  }),
}
