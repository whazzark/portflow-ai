import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('product_lots', (table) => {
      table.uuid('id').primary()
      table
        .uuid('discharge_id')
        .notNullable()
        .references('id')
        .inTable('discharges')
        .onDelete('RESTRICT')
      table
        .uuid('customer_id')
        .notNullable()
        .references('id')
        .inTable('customers')
        .onDelete('RESTRICT')
      table.string('product_name', 255).notNullable()
      table.decimal('expected_quantity_tonnes', 12, 3).notNullable()
      table.text('description').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      // biome-ignore lint/security/noSecrets: SQL constraint, not a secret
      table.check('LENGTH(TRIM(product_name)) > 0')
      table.check('expected_quantity_tonnes > 0')
      table.index(['discharge_id', 'customer_id'])
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX product_lots_identity_unique ON product_lots (discharge_id, customer_id, LOWER(product_name))',
      )
    })
  }

  async down() {
    this.schema.dropTable('product_lots')
  }
}
