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

      const actorColumn = (columnName: string) =>
        table
          .uuid(columnName)
          .nullable()
          .references('id')
          .inTable(this.tableName)
          .onDelete('SET NULL')

      table.timestamp('invited_at').nullable()
      actorColumn('invited_by_user_id')

      table.timestamp('activated_at').nullable()
      actorColumn('activated_by_user_id')

      table.timestamp('cancelled_at').nullable()
      actorColumn('cancelled_by_user_id')

      table.timestamp('deactivated_at').nullable()
      actorColumn('deactivated_by_user_id')

      table.timestamp('reactivated_at').nullable()
      actorColumn('reactivated_by_user_id')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
