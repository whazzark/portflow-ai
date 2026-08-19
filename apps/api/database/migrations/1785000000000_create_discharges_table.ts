import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('discharges', (table) => {
      table.uuid('id').primary()
      table.enum('status', ['PLANNED', 'ACTIVE', 'CLOSED']).notNullable()
      table.string('vessel_name', 255).notNullable()
      table.string('vessel_imo', 32).nullable()
      table.text('vessel_comment').nullable()
      table.uuid('dock_id').notNullable().references('id').inTable('docks').onDelete('RESTRICT')
      table.timestamp('expected_start_at').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      table.check('LENGTH(TRIM(vessel_name)) > 0')
      table.index(['dock_id', 'status'], 'discharges_dock_id_status_index')
    })
  }

  async down() {
    this.schema.dropTable('discharges')
  }
}
