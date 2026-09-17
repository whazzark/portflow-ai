import { BaseSchema } from '@adonisjs/lucid/schema'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'

const ACTIVE_INDEXES = [
  { name: 'discharges_active_dock_unique', table: 'discharges', column: 'dock_id' },
  { name: 'shifts_active_per_discharge_unique', table: 'shifts', column: 'discharge_id' },
] as const

/**
 * The Discharge Start Confirmation records who started a discharge and when, and the first shift
 * records its actual start and who started it. Both are kept apart: a shift's actual start may later
 * be corrected, while the confirmation is an event that never moves.
 *
 * Discharges and shifts that started before the confirmation existed get a start time from their
 * plan, so every started row has one, but no actor: nobody is known to have started them.
 *
 * The partial unique indexes are the backstops of two invariants the start decides under its locks:
 * a dock serves at most one active discharge, and a discharge has at most one active shift. They
 * also hold on SQLite, where the test suite runs and row locks are ignored. Written raw because a
 * partial index is not portable through the schema builder; the statements are the same on both
 * dialects.
 *
 * On SQLite, knex drops a column by rebuilding its table, and `DROP TABLE shifts` is refused while
 * the shift selection tables reference it. As the newest migration, this `down()` runs with the
 * whole schema still standing, so it takes the treatment of
 * `1785500000000_add_user_password_renewal.ts`: enforcement is turned off around the rebuild, which
 * only takes effect outside a transaction. Transactions are disabled for the whole migration, so
 * every other path opens its own: a backfilled table must not be left without its indexes, nor the
 * indexes dropped without their columns.
 */
export default class extends BaseSchema {
  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    this.defer((db) =>
      db.transaction(async (trx) => {
        await trx.schema.alterTable('discharges', (table) => {
          table.timestamp('started_at').nullable()
          table
            .uuid('started_by_user_id')
            .nullable()
            .references('id')
            .inTable('users')
            .onDelete('RESTRICT')
        })
        await trx.schema.alterTable('shifts', (table) => {
          table.timestamp('actual_start_at').nullable()
          table
            .uuid('started_by_user_id')
            .nullable()
            .references('id')
            .inTable('users')
            .onDelete('RESTRICT')
        })

        await trx.rawQuery(
          'UPDATE discharges SET started_at = COALESCE(' +
            '(SELECT MIN(shifts.planned_start_at) FROM shifts WHERE shifts.discharge_id = discharges.id), ' +
            "expected_start_at) WHERE status <> 'PLANNED'",
        )
        await trx.rawQuery(
          "UPDATE shifts SET actual_start_at = planned_start_at WHERE status <> 'PLANNED'",
        )

        for (const index of ACTIVE_INDEXES) {
          await trx.rawQuery(
            `CREATE UNIQUE INDEX ${index.name} ON ${index.table} (${index.column}) WHERE status = 'ACTIVE'`,
          )
        }
      }),
    )
  }

  async down() {
    if (this.isPostgres) {
      this.defer((db) =>
        db.transaction(async (trx) => {
          await this.dropActiveIndexes(trx)
          await this.dropStartColumns(trx)
        }),
      )

      return
    }

    this.defer(async (db) => {
      await this.dropActiveIndexes(db)
      await db.rawQuery('PRAGMA foreign_keys = OFF')

      try {
        await this.dropStartColumns(db)
      } finally {
        await db.rawQuery('PRAGMA foreign_keys = ON')
      }
    })
  }

  private async dropActiveIndexes(client: QueryClientContract) {
    for (const index of ACTIVE_INDEXES) {
      await client.rawQuery(`DROP INDEX ${index.name}`)
    }
  }

  private async dropStartColumns(client: QueryClientContract) {
    await client.schema.alterTable('shifts', (table) => {
      table.dropForeign(['started_by_user_id'])
      table.dropColumn('started_by_user_id')
      table.dropColumn('actual_start_at')
    })
    await client.schema.alterTable('discharges', (table) => {
      table.dropForeign(['started_by_user_id'])
      table.dropColumn('started_by_user_id')
      table.dropColumn('started_at')
    })
  }
}
