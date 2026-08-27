import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Records that a user must choose a new password before reaching the application. Non-null means
 * the requirement stands; a completed renewal sets it back to `NULL`. Existing rows get `NULL`,
 * which is correct — no requirement has ever been recorded.
 *
 * A timestamp rather than a boolean, matching every other state marker on this table
 * (`invited_at`, `activated_at`, `cancelled_at`, `deactivated_at`, `reactivated_at`) and answering
 * "since when" for the administrator-side slices that will write it.
 *
 * No actor column accompanies it, deliberately: this slice never writes the requirement, and the
 * actor belongs to whichever action records it — Reset an Active User Password (`#17`) or Reactivate
 * a User with Fresh Credentials (`#32`).
 *
 * ## `up()` needs no dialect branch; `down()` does
 *
 * The column carries **no foreign key**, so adding it is a plain `ALTER TABLE ADD COLUMN` on both
 * dialects — the same shape as `1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts`.
 * That is the whole of what the `#253` finding covers, and it holds.
 *
 * Dropping it does not. On SQLite, knex implements *any* `dropColumn` by rebuilding the table —
 * create, copy, `DROP TABLE users`, rename — regardless of foreign keys on the column itself, and
 * that DROP is refused while enforcement is on because `remember_me_tokens` and every `*_by_user_id`
 * actor column in the schema reference `users`.
 *
 * The reason this migration is uniquely exposed, where
 * `1785300000000_add_archived_with_warehouse_to_warehouse_doors.ts` gets away with the same
 * `dropColumn`, is **rollback order**: rollback runs newest-first, so that one is reverted long
 * after the tables referencing `warehouse_doors` have been dropped. This is the newest migration in
 * the repository, so its `down()` runs while the whole schema — and the test suite's data — is
 * still standing.
 *
 * So `down()` takes the treatment `1785400000000_add_truck_return_to_service.ts` and
 * `1785200000000_add_transport_companies_contact_details.ts` already document: the pragma is toggled
 * around the rebuild, and transactions are disabled because SQLite silently ignores
 * `PRAGMA foreign_keys` inside one.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('password_renewal_required_at').nullable()
    })
  }

  async down() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('password_renewal_required_at')
      })

      return
    }

    this.defer(async (db) => {
      await this.withoutForeignKeys(db, async () => {
        await db.schema.alterTable(this.tableName, (table) => {
          table.dropColumn('password_renewal_required_at')
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
