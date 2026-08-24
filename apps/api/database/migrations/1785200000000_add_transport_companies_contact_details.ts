import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transport_companies'

  async up() {
    // Adding a table-level CHECK constraint to an existing SQLite table (used by the automated
    // test suite; PostgreSQL is the production database per ADR 0002) forces SQLite's driver to
    // rebuild the table under the hood, which drops and recreates it. `trucks` holds a foreign
    // key to this table, and that DROP is refused while foreign key enforcement is on. Toggling
    // the pragma around the rebuild is SQLite-only and a no-op on PostgreSQL, which supports
    // adding the constraint directly without rebuilding anything.
    this.defer(async (db) => {
      if (db.dialect.name === 'sqlite3') {
        await db.rawQuery('PRAGMA foreign_keys = OFF')
      }
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.string('contact_phone', 32).nullable()
      table.string('contact_email', 255).nullable()
      table.check(
        '(contact_phone IS NULL) = (contact_email IS NULL)',
        [],
        'transport_companies_contact_details_check',
      )
    })

    this.defer(async (db) => {
      if (db.dialect.name === 'sqlite3') {
        await db.rawQuery('PRAGMA foreign_keys = ON')
      }
    })
  }

  async down() {
    this.defer(async (db) => {
      if (db.dialect.name === 'sqlite3') {
        await db.rawQuery('PRAGMA foreign_keys = OFF')
      }
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['transport_companies_contact_details_check'])
      table.dropColumn('contact_phone')
      table.dropColumn('contact_email')
    })

    this.defer(async (db) => {
      if (db.dialect.name === 'sqlite3') {
        await db.rawQuery('PRAGMA foreign_keys = ON')
      }
    })
  }
}
