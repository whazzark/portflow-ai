import db from '@adonisjs/lucid/services/db'
import type { SiteReferenceUsageInput } from '#site_references/shared/site_reference_usage_checker'
import DischargeUsageRepository from './discharge_usage_repository.ts'

const ACTIVE = ['PLANNED', 'ACTIVE']

export default class LucidDischargeUsageRepository extends DischargeUsageRepository {
  async findUsedByPlannedOrActiveDischarge({
    referenceType,
    referenceIds,
    client,
  }: SiteReferenceUsageInput) {
    if (referenceIds.length === 0) {
      return new Set<string>()
    }
    const query = (client ?? db).from('discharges').whereIn('discharges.status', ACTIVE)
    if (referenceType === 'DOCK') {
      query.whereIn('discharges.dock_id', [...referenceIds]).select('discharges.dock_id as id')
    } else if (referenceType === 'CUSTOMER') {
      query
        .join('product_lots', 'product_lots.discharge_id', 'discharges.id')
        .whereIn('product_lots.customer_id', [...referenceIds])
        .select('product_lots.customer_id as id')
    } else if (referenceType === 'WEIGHING_AREA') {
      query
        .join('shifts', 'shifts.discharge_id', 'discharges.id')
        .join('shift_weighing_areas', 'shift_weighing_areas.shift_id', 'shifts.id')
        .whereIn('shift_weighing_areas.weighing_area_id', [...referenceIds])
        .whereNull('shift_weighing_areas.effective_to')
        .select('shift_weighing_areas.weighing_area_id as id')
    } else {
      query
        .join(
          'warehouse_door_product_lot_assignments',
          'warehouse_door_product_lot_assignments.discharge_id',
          'discharges.id',
        )
        .whereIn('warehouse_door_product_lot_assignments.warehouse_door_id', [...referenceIds])
        .whereNull('warehouse_door_product_lot_assignments.effective_to')
        .select('warehouse_door_product_lot_assignments.warehouse_door_id as id')
    }
    const rows = await query.distinct()
    return new Set(rows.map((row) => row.id as string))
  }
}
