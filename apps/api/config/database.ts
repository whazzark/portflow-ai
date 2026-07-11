import { defineConfig } from '@adonisjs/lucid'
import type BetterSqlite3 from 'better-sqlite3'

import env from '#start/env'

const databaseConfig = defineConfig({
  connection: env.get('DB_CONNECTION'),
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: ':memory:',
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
        afterCreate: (conn: BetterSqlite3.Database, done: (err: Error | null) => void) => {
          conn.pragma('foreign_keys = ON')
          done(null)
        },
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default databaseConfig
