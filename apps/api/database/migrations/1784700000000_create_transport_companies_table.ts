import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transport_companies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      const actorColumn = (columnName: string) =>
        table.uuid(columnName).nullable().references('id').inTable('users').onDelete('SET NULL')

      table.uuid('id').primary()
      table.string('name', 255).notNullable()
      table.enum('status', ['AVAILABLE', 'ARCHIVED']).notNullable().defaultTo('AVAILABLE')
      table.timestamp('archived_at').nullable()
      actorColumn('archived_by_user_id')
      table.text('archive_comment').nullable()
      table.timestamp('reactivated_at').nullable()
      actorColumn('reactivated_by_user_id')
      table.text('reactivation_comment').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check(
        "status <> 'ARCHIVED' OR archived_at IS NOT NULL",
        [],
        'transport_companies_archived_at_check',
      )
      table.index(['status'], 'transport_companies_status_index')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
