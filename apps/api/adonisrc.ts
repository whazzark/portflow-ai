import { indexEntities } from '@adonisjs/core'
import { defineConfig } from '@adonisjs/core/app'
import { generateRegistry } from '@tuyau/core/hooks'

export default defineConfig({
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/session/commands'),
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/core/providers/repl_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('./providers/api_provider.js'),
    () => import('./providers/repositories_provider.js'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/auth/auth_provider'),
  ],
  preloads: [() => import('#start/routes'), () => import('#start/kernel')],
  hooks: {
    init: [indexEntities({ transformers: { enabled: true } }), generateRegistry()],
  },
  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.ts'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/integration/**/*.spec.ts'],
        name: 'integration',
        timeout: 5000,
      },
      {
        files: ['tests/browser/**/*.spec.ts'],
        name: 'browser',
        timeout: 300000,
      },
    ],
    forceExit: false,
  },
})
