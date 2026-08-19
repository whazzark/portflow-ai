import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('shifts', (table) => {
      table.uuid('id').primary()
      table
        .uuid('discharge_id')
        .notNullable()
        .references('id')
        .inTable('discharges')
        .onDelete('RESTRICT')
      table.integer('sequence').unsigned().notNullable()
      table.enum('status', ['PLANNED', 'ACTIVE', 'COMPLETED']).notNullable()
      table.timestamp('planned_start_at').notNullable()
      table.timestamp('planned_end_at').notNullable()
      table
        .uuid('responsible_user_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('RESTRICT')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('sequence > 0')
      table.check('planned_start_at < planned_end_at')
      table.unique(['discharge_id', 'sequence'])
      table.index(['discharge_id', 'status'])
    })
  }

  async down() {
    this.schema.dropTable('shifts')
  }
}
