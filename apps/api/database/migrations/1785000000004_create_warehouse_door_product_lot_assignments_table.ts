import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('warehouse_door_product_lot_assignments', (table) => {
      table.uuid('id').primary()
      table
        .uuid('discharge_id')
        .notNullable()
        .references('id')
        .inTable('discharges')
        .onDelete('RESTRICT')
      table
        .uuid('warehouse_door_id')
        .notNullable()
        .references('id')
        .inTable('warehouse_doors')
        .onDelete('RESTRICT')
      table
        .uuid('product_lot_id')
        .notNullable()
        .references('id')
        .inTable('product_lots')
        .onDelete('RESTRICT')
      table.timestamp('effective_from').notNullable()
      table.timestamp('effective_to').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('effective_to IS NULL OR effective_from < effective_to')
      table.unique(['discharge_id', 'warehouse_door_id', 'product_lot_id', 'effective_from'])
      table.index(['warehouse_door_id', 'effective_to'])
    })
  }

  async down() {
    this.schema.dropTable('warehouse_door_product_lot_assignments')
  }
}
