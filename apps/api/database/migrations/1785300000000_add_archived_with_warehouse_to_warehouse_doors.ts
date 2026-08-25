import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'warehouse_doors'

  // Records why a door is archived: `true` when it was archived as part of its warehouse's
  // archival, `false` when it was archived on its own. Reactivating a warehouse (#211) restores
  // exactly the doors carrying `true`, so a door that was already archived beforehand is not
  // resurrected with the building. Existing rows default to `false`, which is correct: no cascade
  // has ever run.
  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('archived_with_warehouse').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('archived_with_warehouse')
    })
  }
}
