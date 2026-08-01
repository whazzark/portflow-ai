import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'warehouse_doors'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table
        .uuid('warehouse_id')
        .notNullable()
        .references('id')
        .inTable('warehouses')
        .onDelete('RESTRICT')
      table.string('name', 255).notNullable()
      table.double('latitude').notNullable()
      table.double('longitude').notNullable()
      table.enum('status', ['AVAILABLE', 'ARCHIVED']).notNullable().defaultTo('AVAILABLE')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('name = TRIM(name)')
      table.check('LENGTH(name) > 0')
      table.check('latitude >= -90 AND latitude <= 90')
      table.check('longitude >= -180 AND longitude <= 180')
      table.index(['warehouse_id', 'status'], 'warehouse_doors_warehouse_status_index')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX warehouse_doors_warehouse_name_unique ON warehouse_doors (warehouse_id, LOWER(name))',
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
