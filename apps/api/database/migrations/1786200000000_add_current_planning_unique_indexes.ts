import { BaseSchema } from '@adonisjs/lucid/schema'

const CURRENT_ROW_INDEXES = [
  {
    name: 'warehouse_door_product_lot_assignments_current_door_unique',
    table: 'warehouse_door_product_lot_assignments',
    columns: 'discharge_id, warehouse_door_id',
  },
  {
    name: 'shift_warehouse_doors_current_unique',
    table: 'shift_warehouse_doors',
    columns: 'shift_id, warehouse_door_id',
  },
  {
    name: 'shift_weighing_areas_current_unique',
    table: 'shift_weighing_areas',
    columns: 'shift_id, weighing_area_id',
  },
] as const

/**
 * At most one current row per door within a discharge, and per door or weighing area within a
 * shift. A row is current while its `effective_to` is null; ended rows are history and may repeat.
 *
 * The planning commands decide these rules under the discharge's row lock, which is the guarantee
 * on PostgreSQL. These indexes are the backstop that also holds on SQLite, where the test suite
 * runs and row locks are ignored. The door index is per discharge, not per site: a door may be
 * current in several planned discharges, and the start confirmation decides which one uses it.
 *
 * Written raw because a partial index is not portable through the schema builder; the statement is
 * the same on both dialects.
 */
export default class extends BaseSchema {
  async up() {
    for (const index of CURRENT_ROW_INDEXES) {
      this.schema.raw(
        `CREATE UNIQUE INDEX ${index.name} ON ${index.table} (${index.columns}) WHERE effective_to IS NULL`,
      )
    }
  }

  async down() {
    for (const index of CURRENT_ROW_INDEXES) {
      this.schema.raw(`DROP INDEX ${index.name}`)
    }
  }
}
