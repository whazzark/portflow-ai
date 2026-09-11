import { Env } from '@adonisjs/core/env'

/**
 * Validates `WEB_ORIGIN` and strips its trailing slashes, once, for every reader: a browser's
 * `Origin` header never carries one, so a value kept as typed would build correct activation links
 * while silently refusing every cross-origin request.
 */
export const validateWebOrigin = (key: string, value?: string) =>
  Env.schema.string({ format: 'url', tld: false })(key, value).replace(/\/+$/, '')

export default await Env.create(new URL('../', import.meta.url), {
  /*
  |----------------------------------------------------------
  | Variables for configuring app
  |----------------------------------------------------------
  */
  TZ: Env.schema.string(),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  APP_KEY: Env.schema.string(),
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring database
  |----------------------------------------------------------
  */
  DB_CONNECTION: Env.schema.enum(['postgres', 'sqlite'] as const),
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  /**
   * The web application's public origin. Required, not optional: it is both the CORS allow-list and
   * the base of every confidential activation link, and a link built from a guessed origin would be
   * handed to a person as if it worked. A missing value fails at boot instead.
   *
   * `tld: false` because every non-production origin is `http://localhost:<port>`, which the default
   * URL rule rejects for having no top-level domain; the protocol is still required.
   */
  WEB_ORIGIN: validateWebOrigin,
})
