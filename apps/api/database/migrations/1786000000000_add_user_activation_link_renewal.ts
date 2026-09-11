import { BaseSchema } from '@adonisjs/lucid/schema'

const NEW_COLUMNS = ['activation_link_renewed_at', 'activation_link_renewed_by_user_id'] as const

/**
 * The event behind a replaced activation link: when an organization admin last renewed this pending
 * user's link, and which administrator did it.
 *
 * ## Event, not state
 *
 * The link itself stays in `user_activation_tokens`, one row per pending user, and a renewal
 * replaces that row. These two columns are the renewal's own **event**: overwritten by every
 * renewal — only the most recent one is kept — and never cleared, not even when the user later
 * activates, so the access record can still answer "who handed out the link this person activated
 * with". The same reading as `password_reset_at` / `password_reset_by_user_id`, and for the same
 * reason: a renewal changes no access status, yet it answers the question the access history is
 * there to answer.
 *
 * A timestamp rather than a boolean, and an actor column shaped exactly like every other
 * `*_by_user_id` on `users` — nullable, `ON DELETE SET NULL` — so a renewal survives the departure
 * of the administrator who performed it.
 *
 * ## Both `up()` and `down()` need the dialect branch
 *
 * For the reason `1785800000000_add_user_password_reset.ts` documents: on SQLite, knex implements
 * any added column carrying a `REFERENCES` clause by rebuilding the whole table, and the rebuild's
 * `DROP TABLE users` is refused while foreign-key enforcement is on, because `remember_me_tokens`,
 * `user_activation_tokens`, and every `*_by_user_id` column reference `users`. The pragma only
 * takes effect outside a transaction — hence `disableTransactions`. This is the newest migration, so
 * its `down()` runs first on rollback, while the whole schema is still standing.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        this.addColumns(table)
      })

      return
    }

    this.defer(async (db) => {
      await this.withoutForeignKeys(db, async () => {
        await db.schema.alterTable(this.tableName, (table) => {
          this.addColumns(table)
        })
      })
    })
  }

  async down() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        for (const column of NEW_COLUMNS) {
          table.dropColumn(column)
        }
      })

      return
    }

    this.defer(async (db) => {
      await this.withoutForeignKeys(db, async () => {
        await db.schema.alterTable(this.tableName, (table) => {
          for (const column of NEW_COLUMNS) {
            table.dropColumn(column)
          }
        })
      })
    })
  }

  private addColumns(table: Parameters<Parameters<typeof this.schema.alterTable>[1]>[0]) {
    table.timestamp('activation_link_renewed_at').nullable()
    table
      .uuid('activation_link_renewed_by_user_id')
      .nullable()
      .references('id')
      .inTable(this.tableName)
      .onDelete('SET NULL')
  }

  /**
   * SQLite has no way to alter a table in place once a foreign key is involved, so knex replaces it.
   * The replacement's `DROP TABLE` is refused by the children of `users` unless enforcement is off,
   * and the pragma only takes effect outside a transaction — hence `disableTransactions` above.
   */
  private async withoutForeignKeys(db: typeof this.db, run: () => Promise<void>) {
    await db.rawQuery('PRAGMA foreign_keys = OFF')

    try {
      await run()
    } finally {
      await db.rawQuery('PRAGMA foreign_keys = ON')
    }
  }
}
