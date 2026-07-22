import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'customers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      const actorColumn = (columnName: string) =>
        table.uuid(columnName).nullable().references('id').inTable('users').onDelete('SET NULL')

      table.timestamp('archived_at').nullable()
      actorColumn('archived_by_user_id')
      table.text('archive_comment').nullable()
      table.timestamp('reactivated_at').nullable()
      actorColumn('reactivated_by_user_id')
      table.text('reactivation_comment').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('archived_at')
      table.dropColumn('archived_by_user_id')
      table.dropColumn('archive_comment')
      table.dropColumn('reactivated_at')
      table.dropColumn('reactivated_by_user_id')
      table.dropColumn('reactivation_comment')
    })
  }
}
