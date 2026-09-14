import { BaseSchema } from '@adonisjs/lucid/schema'

const NEW_COLUMNS = [
  'invitation_restored_at',
  'invitation_restored_by_user_id',
  'invitation_restoration_comment',
] as const

/**
 * The event behind a restored invitation: when an organization admin last made this cancelled
 * user's invitation pending again, which administrator did it, and what they said about it.
 *
 * ## Event, not state
 *
 * A restoration is an access status change — `CANCELLED` back to `PENDING` — and the access record
 * keeps one dated, attributed slot per kind of change, the latest only, as it does for
 * `cancelled_*`, `deactivated_*`, and `reactivated_*`. These columns are overwritten by every
 * restoration, the comment included, and cleared by nothing: a later cancellation replaces the
 * cancellation columns and leaves these alone, so the record keeps saying who restored the
 * invitation a person later activated through.
 *
 * ## Named after the invitation
 *
 * `invitation_restored_*` rather than `restored_*`: on `users`, a bare `restored_at` reads as "user
 * restoration", the term `CONTEXT.md` lists to avoid — it means a reactivation there. The renewal
 * set the precedent of naming what the event acts on (`activation_link_renewed_*`).
 *
 * The comment is `text` rather than a bounded `string`, for the reason `cancellation_comment`
 * gives: the 1,000-character limit is the lifecycle comment rule, enforced in the request validator,
 * and the column must not become a second, divergent authority on it.
 *
 * ## Both `up()` and `down()` need the dialect branch
 *
 * For the reason `1786000000000_add_user_activation_link_renewal.ts` documents: on SQLite, knex
 * implements an added column carrying a `REFERENCES` clause by rebuilding `users`, and the rebuild's
 * `DROP TABLE users` is refused while foreign-key enforcement is on, because `remember_me_tokens`,
 * `user_activation_tokens`, and every `*_by_user_id` column reference `users`. The pragma only takes
 * effect outside a transaction — hence `disableTransactions`.
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
    table.timestamp('invitation_restored_at').nullable()
    table
      .uuid('invitation_restored_by_user_id')
      .nullable()
      .references('id')
      .inTable(this.tableName)
      .onDelete('SET NULL')
    table.text('invitation_restoration_comment').nullable()
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
