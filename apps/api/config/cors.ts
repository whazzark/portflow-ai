import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

const webOrigin = env.get('WEB_ORIGIN')

export default defineConfig({
  enabled: true,
  origin: webOrigin ? [webOrigin] : true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})
