import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected warehousesTable = 'warehouses'
  protected pointsTable = 'warehouse_footprint_points'

  async up() {
    this.schema.createTable(this.warehousesTable, (table) => {
      table.uuid('id').primary()
      table.string('name').notNullable()
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
    })

    this.schema.createTable(this.pointsTable, (table) => {
      table
        .uuid('warehouse_id')
        .notNullable()
        .references('id')
        .inTable(this.warehousesTable)
        .onDelete('CASCADE')
      table.integer('position').unsigned().notNullable()
      table.double('latitude').notNullable()
      table.double('longitude').notNullable()
      table.primary(['warehouse_id', 'position'])
      table.check('latitude >= -90 AND latitude <= 90')
      table.check('longitude >= -180 AND longitude <= 180')
    })

    this.defer(async (db) => {
      await db.rawQuery('CREATE UNIQUE INDEX warehouses_name_unique ON warehouses (LOWER(name))')
      await db.rawQuery('CREATE INDEX warehouses_status_index ON warehouses (status)')
    })
  }

  async down() {
    this.schema.dropTable(this.pointsTable)
    this.schema.dropTable(this.warehousesTable)
  }
}
