import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.createMembership('shift_trucks', 'truck_id', 'trucks')
  }
  async down() {
    this.schema.dropTable('shift_trucks')
  }

  private createMembership(tableName: string, resourceColumn: string, resourceTable: string) {
    this.schema.createTable(tableName, (table) => {
      table.uuid('id').primary()
      table.uuid('shift_id').notNullable().references('id').inTable('shifts').onDelete('RESTRICT')
      table
        .uuid(resourceColumn)
        .notNullable()
        .references('id')
        .inTable(resourceTable)
        .onDelete('RESTRICT')
      table.timestamp('effective_from').notNullable()
      table.timestamp('effective_to').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('effective_to IS NULL OR effective_from < effective_to')
      table.unique(['shift_id', resourceColumn, 'effective_from'])
      table.index([resourceColumn, 'effective_to'])
    })
  }
}
