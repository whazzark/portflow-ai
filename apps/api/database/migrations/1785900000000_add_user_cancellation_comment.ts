import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * The administrator's optional comment on an invitation cancellation.
 *
 * It sits beside `cancelled_at` and `cancelled_by_user_id`, the event it annotates, the way
 * customers keep `archive_comment` beside `archived_at`. Like them it holds the **latest**
 * cancellation only: the access record keeps the latest useful dates and actors on the user, so a
 * cancellation after a later restoration replaces the comment together with the date and the actor.
 * A per-event history is deliberately not introduced here.
 *
 * `text` rather than a bounded `string`: the 1,000-character limit is the lifecycle comment rule
 * every lifecycle comment in the product shares, and it is enforced where the others enforce it — in
 * the request validator — so the column does not become a second, divergent authority on it.
 *
 * ## Only `down()` needs the dialect branch
 *
 * The column carries no foreign key, so SQLite adds it in place and `up()` stays the plain
 * `alterTable` of `1785500000000_add_user_password_renewal.ts`. Dropping it is another matter: SQLite
 * cannot drop a column in place once the table has foreign-key children, so knex rebuilds `users`,
 * and the rebuild's `DROP TABLE` is refused while `remember_me_tokens`, `user_activation_tokens`, and
 * every `*_by_user_id` column enforce their references. `down()` therefore takes the treatment that
 * migration documents: the pragma is toggled around the rebuild, and transactions are disabled
 * because SQLite silently ignores `PRAGMA foreign_keys` inside one.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('cancellation_comment').nullable()
    })
  }

  async down() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('cancellation_comment')
      })

      return
    }

    this.defer(async (db) => {
      await this.withoutForeignKeys(db, async () => {
        await db.schema.alterTable(this.tableName, (table) => {
          table.dropColumn('cancellation_comment')
        })
      })
    })
  }

  /**
   * SQLite cannot drop a column in place, so knex replaces the table. The replacement's
   * `DROP TABLE` is refused by the children of `users` unless enforcement is off, and the pragma
   * only takes effect outside a transaction — hence `disableTransactions` above.
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
