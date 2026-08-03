import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'trucks'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('registration').notNullable()
      table.string('vehicle_model').nullable()
      table.decimal('capacity_tonnes', 12, 3).notNullable()
      table
        .uuid('transport_company_id')
        .notNullable()
        .references('id')
        .inTable('transport_companies')
        .onDelete('RESTRICT')
      table.enum('status', ['AVAILABLE', 'ARCHIVED']).notNullable().defaultTo('AVAILABLE')
      table.timestamp('archived_at').nullable()
      table
        .uuid('archived_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('archive_comment').nullable()
      table.timestamp('reactivated_at').nullable()
      table
        .uuid('reactivated_by_user_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
      table.text('reactivation_comment').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('capacity_tonnes > 0')
      table.check("status != 'ARCHIVED' OR archived_at IS NOT NULL")
      table.index(['status'], 'trucks_status_index')
      table.index(['transport_company_id'], 'trucks_transport_company_id_index')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        // biome-ignore lint/security/noSecrets: SQL index definition, not a secret
        'CREATE UNIQUE INDEX trucks_registration_unique ON trucks (LOWER(registration))',
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
