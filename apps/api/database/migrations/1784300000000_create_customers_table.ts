import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('code').notNullable()
      table.string('company_name').notNullable()
      table.enum('status', ['AVAILABLE', 'ARCHIVED']).notNullable().defaultTo('AVAILABLE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })

    this.defer(async (db) => {
      await db.rawQuery('CREATE UNIQUE INDEX customers_code_unique ON customers (LOWER(code))')
      await db.rawQuery(
        'CREATE UNIQUE INDEX customers_company_name_unique ON customers (LOWER(company_name))',
      )
      await db.rawQuery('CREATE INDEX customers_status_index ON customers (status)')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
