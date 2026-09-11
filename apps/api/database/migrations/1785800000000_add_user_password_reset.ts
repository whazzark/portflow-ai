import { BaseSchema } from '@adonisjs/lucid/schema'

const NEW_COLUMNS = ['password_reset_at', 'password_reset_by_user_id'] as const

/**
 * The administrator-side event behind a password renewal requirement: when an organization admin
 * reset this user's password, and which administrator did it.
 *
 * `1785500000000_add_user_password_renewal.ts` shipped `password_renewal_required_at` with no actor
 * column on purpose, noting that "the actor belongs to whichever action records it — Reset an Active
 * User Password (`#17`) or Reactivate a User with Fresh Credentials (`#32`)". These two columns are
 * `#17` taking up that offer.
 *
 * ## Event, not state
 *
 * `password_renewal_required_at` stays the enforcement **state**: written by a reset or a
 * reactivation, cleared by a completed renewal. These two are this action's own **event**, and are
 * never cleared — so the access record can still answer "who reset this user, and when" long after
 * the user has renewed. That split is also what lets `#32` land without touching this migration: it
 * writes `reactivated_at` / `reactivated_by_user_id` and the same shared state.
 *
 * A timestamp rather than a boolean, and an actor column shaped exactly like the five in
 * `1783663779445_create_users_table.ts` — nullable, `ON DELETE SET NULL` — so a reset survives the
 * departure of the administrator who performed it.
 *
 * ## Both `up()` and `down()` need the dialect branch
 *
 * `1785500000000_add_user_password_renewal.ts` got away with a plain `up()` because its one column
 * carries no foreign key. This one does, and on SQLite knex implements *any* added column carrying a
 * `REFERENCES` clause by rebuilding the whole table — create, copy, `DROP TABLE users`, rename. That
 * DROP is refused while enforcement is on, because `remember_me_tokens` and every `*_by_user_id`
 * actor column in the schema reference `users`. This is the same reason
 * `1785400000000_add_truck_return_to_service.ts` branches in `up()`, one table over.
 *
 * `down()` is exposed for the additional reason that migration's neighbour documents: rollback runs
 * newest-first, and this is the newest migration in the repository, so its `down()` runs while the
 * whole schema — and the test suite's data — is still standing.
 *
 * So both directions take the treatment already documented here: the pragma is toggled around the
 * rebuild, and transactions are disabled because SQLite silently ignores `PRAGMA foreign_keys`
 * inside one.
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
    table.timestamp('password_reset_at').nullable()
    table
      .uuid('password_reset_by_user_id')
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
