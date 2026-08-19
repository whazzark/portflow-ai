import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('discharge_truck_assignments', (table) => {
      table.uuid('id').primary()
      table
        .uuid('discharge_id')
        .notNullable()
        .references('id')
        .inTable('discharges')
        .onDelete('RESTRICT')
      table.uuid('truck_id').notNullable().references('id').inTable('trucks').onDelete('RESTRICT')
      table.string('registration_snapshot', 64).notNullable()
      table
        .uuid('transport_company_id')
        .nullable()
        .references('id')
        .inTable('transport_companies')
        .onDelete('SET NULL')
      table.string('transport_company_name_snapshot', 255).notNullable()
      table.timestamp('reserved_at').notNullable()
      table.timestamp('released_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
      // biome-ignore lint/security/noSecrets: SQL constraint, not a secret
      table.check('LENGTH(TRIM(registration_snapshot)) > 0')
      // biome-ignore lint/security/noSecrets: SQL constraint, not a secret
      table.check('LENGTH(TRIM(transport_company_name_snapshot)) > 0')
      table.check('released_at IS NULL OR released_at >= reserved_at')
      table.unique(['discharge_id', 'truck_id'])
      table.index(['truck_id', 'released_at'])
    })
  }

  async down() {
    this.schema.dropTable('discharge_truck_assignments')
  }
}
