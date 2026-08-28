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
   * Dropping the column in the same release that stops writing it is safe under this project's
   * deployment, and only under it: the API runs as a single container, replaced by
   * `docker compose --profile prod up` before `migration:run` is executed by hand against the new
   * one (README). No build that still writes `archived_with_warehouse` is ever serving once the
   * column is gone. The window that procedure does open is the reverse one — the new build serving
   * against the not-yet-migrated schema — and it is harmless: the column it no longer writes is
   * `NOT NULL DEFAULT false`, so an insert that omits it succeeds. A second API instance, or any
   * rolling replacement, would invalidate that reasoning; the drop would then have to ship a
   * release behind the code that stopped writing the column.
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
