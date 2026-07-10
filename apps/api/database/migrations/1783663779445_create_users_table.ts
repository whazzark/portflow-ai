import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()

      table.string('first_name').notNullable()
      table.string('last_name').notNullable()
      table.string('email').notNullable().unique()
      table.string('password').nullable()
      table.string('role').notNullable()
      table.string('access_status').notNullable().defaultTo('PENDING')

      table.timestamp('invited_at').nullable()
      table
        .uuid('invited_by_user_id')
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')

      table.timestamp('activated_at').nullable()

      table.timestamp('cancelled_at').nullable()
      table
        .uuid('cancelled_by_user_id')
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')

      table.timestamp('deactivated_at').nullable()
      table
        .uuid('deactivated_by_user_id')
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')

      table.timestamp('reactivated_at').nullable()
      table
        .uuid('reactivated_by_user_id')
        .nullable()
        .references('id')
        .inTable(this.tableName)
        .onDelete('SET NULL')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
