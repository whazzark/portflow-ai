import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'weighing_areas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('name').notNullable()
      table.double('latitude').notNullable()
      table.double('longitude').notNullable()
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
      table.check('latitude >= -90 AND latitude <= 90')
      table.check('longitude >= -180 AND longitude <= 180')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'CREATE UNIQUE INDEX weighing_areas_name_unique ON weighing_areas (LOWER(name))',
      )
      await db.rawQuery('CREATE INDEX weighing_areas_status_index ON weighing_areas (status)')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
