import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transport_companies'

  // Adding or dropping a table-level CHECK constraint on SQLite (used by the automated test
  // suite; PostgreSQL is the production database per ADR 0002) forces the driver to rebuild the
  // table, which drops and recreates it. `trucks` holds a foreign key to this table, so that DROP
  // is refused once any truck row exists unless foreign-key enforcement is off — and SQLite
  // silently ignores `PRAGMA foreign_keys` inside a transaction. Running this migration outside a
  // transaction lets the driver toggle the pragma around the rebuild itself. PostgreSQL alters the
  // table in place, so it never rebuilds and only loses the (single-statement) DDL atomicity.
  static disableTransactions = true

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('contact_phone', 32).nullable()
      table.string('contact_email', 255).nullable()
      table.check(
        '(contact_phone IS NULL) = (contact_email IS NULL)',
        [],
        'transport_companies_contact_details_check',
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropChecks(['transport_companies_contact_details_check'])
      table.dropColumn('contact_phone')
      table.dropColumn('contact_email')
    })
  }
}
