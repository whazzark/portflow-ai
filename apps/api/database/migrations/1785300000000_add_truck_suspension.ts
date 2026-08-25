import { BaseSchema } from '@adonisjs/lucid/schema'

const REBUILD_TABLE = 'trucks_suspension_rebuild'

/**
 * Columns carried over from the pre-suspension `trucks` table, in their original order. Listed
 * explicitly so the SQLite rebuild copies by name rather than by position.
 */
const CARRIED_COLUMNS = [
  'id',
  'registration',
  'vehicle_model',
  'capacity_tonnes',
  'transport_company_id',
  'status',
  'archived_at',
  'archived_by_user_id',
  'archive_comment',
  'reactivated_at',
  'reactivated_by_user_id',
  'reactivation_comment',
  'created_at',
  'updated_at',
].join(', ')

export default class extends BaseSchema {
  protected tableName = 'trucks'

  // The status column is an enum, which knex renders as a CHECK constraint rather than a native
  // type. Widening it cannot go through `table.enum(...).alter()`: on SQLite that reports success
  // while leaving the original two-value CHECK in place beside the new one, so inserting
  // 'SUSPENDED' still fails; on PostgreSQL it emits invalid SQL
  // (`using ("status"::text::text check (...))`). Each dialect therefore gets its own path.
  //
  // SQLite has no DROP CONSTRAINT at all, so its path rebuilds the table. `trucks` is referenced by
  // `discharge_truck_assignments` and `shift_trucks`, so the DROP is refused while foreign-key
  // enforcement is on — and SQLite silently ignores `PRAGMA foreign_keys` inside a transaction.
  // Running outside a transaction lets the pragma be toggled around the rebuild, the same reason
  // `1785200000000_add_transport_companies_contact_details.ts` documents. PostgreSQL alters in
  // place, and keeps its constraint swap in a single ALTER TABLE so that losing the surrounding
  // transaction costs it no atomicity.
  static disableTransactions = true

  private get isPostgres() {
    return this.db.dialect.name === 'postgres'
  }

  async up() {
    if (this.isPostgres) {
      this.schema.alterTable(this.tableName, (table) => {
        table.timestamp('suspended_at').nullable()
        table
          .uuid('suspended_by_user_id')
          .nullable()
          .references('id')
          .inTable('users')
          .onDelete('SET NULL')
        table.text('suspension_comment').nullable()
      })

      this.defer(async (db) => {
        const constraintName = await this.findStatusEnumConstraint()

        // One statement, not three. Transactions are disabled for the SQLite path below, so a
        // failure between a DROP and its replacement ADD would leave `trucks` accepting any status
        // with no migration row recorded, and a re-run would then fail on the already-added
        // columns. PostgreSQL applies the subcommands of a single ALTER TABLE atomically.
        await db.rawQuery(
          `ALTER TABLE trucks
             DROP CONSTRAINT "${constraintName}",
             ADD CONSTRAINT trucks_status_check CHECK (status IN ('AVAILABLE', 'ARCHIVED', 'SUSPENDED')),
             ADD CONSTRAINT trucks_suspended_at_check CHECK (status <> 'SUSPENDED' OR suspended_at IS NOT NULL)`,
        )
      })

      return
    }

    // Indexes are deliberately omitted here and recreated after the rename: index names are global
    // in SQLite, so declaring them on the rebuild table would collide with the ones still held by
    // the table being replaced.
    this.schema.createTable(REBUILD_TABLE, (table) => {
      table.uuid('id').primary()
      table.string('registration').notNullable()
      table.string('vehicle_model').nullable()
      table.decimal('capacity_tonnes', 12, 3).notNullable()
      table
        .uuid('transport_company_id')
        .notNullable()
        .references('id')
        .inTable('transport_companies')
        .onDelete('RESTRICT')
      table
        .enum('status', ['AVAILABLE', 'ARCHIVED', 'SUSPENDED'])
        .notNullable()
        .defaultTo('AVAILABLE')
      table.timestamp('archived_at').nullable()
      table
        .uuid('archived_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('archive_comment').nullable()
      table.timestamp('reactivated_at').nullable()
      table
        .uuid('reactivated_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('reactivation_comment').nullable()
      table.timestamp('suspended_at').nullable()
      table
        .uuid('suspended_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('suspension_comment').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('capacity_tonnes > 0')
      table.check("status != 'ARCHIVED' OR archived_at IS NOT NULL")
      table.check("status != 'SUSPENDED' OR suspended_at IS NOT NULL")
    })

    this.defer(async (db) => {
      await this.swapRebuiltTable(db)
    })
  }

  async down() {
    if (this.isPostgres) {
      this.defer(async (db) => {
        // The two-value constraint cannot describe a suspended truck. Returning those rows to the
        // state they were suspended from is the only reversal available; the suspension context
        // columns are dropped with them.
        await db.rawQuery("UPDATE trucks SET status = 'AVAILABLE' WHERE status = 'SUSPENDED'")
        // Dropped and re-added in one statement, for the same atomicity reason as `up()`.
        await db.rawQuery(
          `ALTER TABLE trucks
             DROP CONSTRAINT trucks_suspended_at_check,
             DROP CONSTRAINT trucks_status_check,
             ADD CONSTRAINT trucks_status_check CHECK (status IN ('AVAILABLE', 'ARCHIVED'))`,
        )
      })

      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('suspended_at')
        table.dropColumn('suspended_by_user_id')
        table.dropColumn('suspension_comment')
      })

      return
    }

    this.schema.createTable(REBUILD_TABLE, (table) => {
      table.uuid('id').primary()
      table.string('registration').notNullable()
      table.string('vehicle_model').nullable()
      table.decimal('capacity_tonnes', 12, 3).notNullable()
      table
        .uuid('transport_company_id')
        .notNullable()
        .references('id')
        .inTable('transport_companies')
        .onDelete('RESTRICT')
      table.enum('status', ['AVAILABLE', 'ARCHIVED']).notNullable().defaultTo('AVAILABLE')
      table.timestamp('archived_at').nullable()
      table
        .uuid('archived_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('archive_comment').nullable()
      table.timestamp('reactivated_at').nullable()
      table
        .uuid('reactivated_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('reactivation_comment').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('capacity_tonnes > 0')
      table.check("status != 'ARCHIVED' OR archived_at IS NOT NULL")
    })

    this.defer(async (db) => {
      await db.rawQuery("UPDATE trucks SET status = 'AVAILABLE' WHERE status = 'SUSPENDED'")
      await this.swapRebuiltTable(db)
    })
  }

  /**
   * Copies `trucks` into the freshly created rebuild table, replaces the original with it, and
   * recreates the three indexes the original carried. Foreign-key enforcement is off for the swap
   * so the DROP is not refused by `discharge_truck_assignments` and `shift_trucks`; their own
   * definitions reference `trucks` by name and so bind to the replacement after the rename.
   */
  private async swapRebuiltTable(db: typeof this.db) {
    await db.rawQuery('PRAGMA foreign_keys = OFF')

    try {
      await db.rawQuery(
        `INSERT INTO ${REBUILD_TABLE} (${CARRIED_COLUMNS}) SELECT ${CARRIED_COLUMNS} FROM trucks`,
      )
      await db.rawQuery('DROP TABLE trucks')
      await db.rawQuery(`ALTER TABLE ${REBUILD_TABLE} RENAME TO trucks`)
      await db.rawQuery('CREATE INDEX trucks_status_index ON trucks (status)')
      await db.rawQuery(
        'CREATE INDEX trucks_transport_company_id_index ON trucks (transport_company_id)',
      )
      await db.rawQuery(
        // biome-ignore lint/security/noSecrets: SQL index definition, not a secret
        'CREATE UNIQUE INDEX trucks_registration_unique ON trucks (LOWER(registration))',
      )
    } finally {
      await db.rawQuery('PRAGMA foreign_keys = ON')
    }
  }

  /**
   * PostgreSQL auto-names the CHECK constraint knex renders for an enum column, so the name is not
   * guaranteed. Looking it up beats `DROP CONSTRAINT IF EXISTS`, which would silently no-op against
   * a different name and leave the two-value constraint enforcing.
   */
  private async findStatusEnumConstraint(): Promise<string> {
    const result = await this.db.rawQuery(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'trucks'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'
        AND pg_get_constraintdef(oid) LIKE '%ARCHIVED%'
        AND pg_get_constraintdef(oid) NOT LIKE '%archived_at%'
    `)

    const names: string[] = result.rows.map((row: { conname: string }) => row.conname)

    if (names.length !== 1) {
      throw new Error(
        `Expected exactly one status enum CHECK constraint on "trucks", found ${names.length}: ${names.join(', ') || '(none)'}`,
      )
    }

    return names[0]
  }
}
