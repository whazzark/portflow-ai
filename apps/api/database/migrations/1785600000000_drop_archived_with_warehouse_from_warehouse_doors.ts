import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'warehouse_doors'

  /**
   * Drops the provenance marker `1785300000000` introduced. Archiving a warehouse now archives
   * every one of its doors without exception, and reactivating it brings every one of them back,
   * so the marker no longer decides anything: the containing warehouse's own status says it. An
   * archived warehouse holds none but doors archived with it; an available one holds only doors
   * archived on their own.
   *
   * `ALTER TABLE ... DROP COLUMN` is written raw rather than through `table.dropColumn`, which on
   * SQLite makes knex rebuild the whole table — and the rebuild's `DROP TABLE` is refused by the
   * children of `warehouse_doors` (`shift_warehouse_doors`,
   * `warehouse_door_product_lot_assignments`). The raw statement is the same on both dialects and
   * rebuilds nothing.
   */
  async up() {
    this.schema.raw(`ALTER TABLE ${this.tableName} DROP COLUMN archived_with_warehouse`)
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('archived_with_warehouse').notNullable().defaultTo(false)
    })
  }
}
