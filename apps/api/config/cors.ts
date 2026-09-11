import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

export default defineConfig({
  enabled: true,
  // Always a single, configured origin: `WEB_ORIGIN` is required, so there is no permissive fallback
  // left to fall back to.
  origin: [env.get('WEB_ORIGIN')],
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})
