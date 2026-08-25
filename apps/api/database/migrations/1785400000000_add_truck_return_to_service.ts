import { BaseSchema } from '@adonisjs/lucid/schema'

const NEW_COLUMNS = [
  'returned_to_service_at',
  'returned_to_service_by_user_id',
  'return_to_service_comment',
] as const

/**
 * Returning a suspended truck to service is the reverse of `1785300000000_add_truck_suspension.ts`,
 * and the schema change is much smaller: three nullable columns, no new status value, no check
 * constraint to widen.
 *
 * It still needs a dialect branch, for a reason that is easy to miss. On PostgreSQL this is a plain
 * `ALTER TABLE ADD COLUMN`. On SQLite, knex implements *any* added column carrying a `REFERENCES`
 * clause by rebuilding the whole table — create, copy, `DROP TABLE trucks`, rename — and that DROP is
 * refused while foreign-key enforcement is on, because `discharge_truck_assignments` and
 * `shift_trucks` both reference `trucks`. The additive pattern in
 * `1784400000000_add_customer_lifecycle_metadata.ts` works only because nothing references
 * `customers`.
 *
 * So the actor column takes the same treatment `1785200000000_add_transport_companies_contact_details.ts`
 * and the suspension migration already document: the pragma is toggled around the rebuild, and
 * transactions are disabled because SQLite silently ignores `PRAGMA foreign_keys` inside one.
 *
 * No paired `NOT NULL` check accompanies these columns, unlike the archived and suspended ones. Those
 * states are meaningless without their timestamp, so `status = 'ARCHIVED' ⇒ archived_at IS NOT NULL`
 * holds. `AVAILABLE` is the default state of every truck ever created, almost none of which has been
 * returned to service, so the equivalent rule would be false for the whole table.
 *
 * The suspension columns are deliberately left populated when a truck comes back: the delivered
 * `status <> 'SUSPENDED' OR suspended_at IS NOT NULL` check is one-directional, so an AVAILABLE row
 * still carrying its `suspended_at` — exactly what a returned truck is — is already legal.
 */
export default class extends BaseSchema {
  protected tableName = 'trucks'

  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        table.timestamp('returned_to_service_at').nullable()
        table
          .uuid('returned_to_service_by_user_id')
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL')
        table.text('return_to_service_comment').nullable()
      })

      return
    }

    this.defer(async (db) => {
      await this.withoutForeignKeys(db, async () => {
        await db.schema.alterTable(this.tableName, (table) => {
          table.timestamp('returned_to_service_at').nullable()
          table
            .uuid('returned_to_service_by_user_id')
            .nullable()
            .references('id')
            .inTable('users')
            .onDelete('SET NULL')
          table.text('return_to_service_comment').nullable()
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

  /**
   * SQLite has no way to alter a table in place once a foreign key is involved, so knex replaces it.
   * The replacement's `DROP TABLE` is refused by the children of `trucks` unless enforcement is off,
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
