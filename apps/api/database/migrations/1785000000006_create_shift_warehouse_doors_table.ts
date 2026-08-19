import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('shift_warehouse_doors', (table) => {
      table.uuid('id').primary()
      table.uuid('shift_id').notNullable().references('id').inTable('shifts').onDelete('RESTRICT')
      table
        .uuid('warehouse_door_id')
        .notNullable()
        .references('id')
        .inTable('warehouse_doors')
        .onDelete('RESTRICT')
      table.timestamp('effective_from').notNullable()
      table.timestamp('effective_to').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('effective_to IS NULL OR effective_from < effective_to')
      table.unique(['shift_id', 'warehouse_door_id', 'effective_from'])
      table.index(['warehouse_door_id', 'effective_to'])
    })
  }
  async down() {
    this.schema.dropTable('shift_warehouse_doors')
  }
}
