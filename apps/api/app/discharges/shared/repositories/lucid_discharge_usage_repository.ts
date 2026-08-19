import db from '@adonisjs/lucid/services/db'
import type { SiteReferenceUsageInput } from '#site_references/shared/site_reference_usage_checker'
import DischargeUsageRepository from './discharge_usage_repository.ts'

const ACTIVE = ['PLANNED', 'ACTIVE'] as const

export default class LucidDischargeUsageRepository extends DischargeUsageRepository {
  async findUsedByPlannedOrActiveDischarge({
    referenceType,
    referenceIds,
    client,
  }: SiteReferenceUsageInput) {
    const uniqueReferenceIds = [...new Set(referenceIds)]
    if (uniqueReferenceIds.length === 0) {
      return new Set<string>()
    }
    const query = (client ?? db).from('discharges').whereIn('discharges.status', [...ACTIVE])
    switch (referenceType) {
      case 'DOCK':
        query.whereIn('discharges.dock_id', uniqueReferenceIds).select('discharges.dock_id as id')
        break
      case 'CUSTOMER':
        query
          .join('product_lots', 'product_lots.discharge_id', 'discharges.id')
          .whereIn('product_lots.customer_id', uniqueReferenceIds)
          .select('product_lots.customer_id as id')
        break
      case 'WEIGHING_AREA':
        query
          .join('shifts', 'shifts.discharge_id', 'discharges.id')
          .join('shift_weighing_areas', 'shift_weighing_areas.shift_id', 'shifts.id')
          .whereIn('shift_weighing_areas.weighing_area_id', uniqueReferenceIds)
          .whereNull('shift_weighing_areas.effective_to')
          .select('shift_weighing_areas.weighing_area_id as id')
        break
      case 'WAREHOUSE_DOOR':
        query
          .join(
            'warehouse_door_product_lot_assignments',
            'warehouse_door_product_lot_assignments.discharge_id',
            'discharges.id',
          )
          .whereIn('warehouse_door_product_lot_assignments.warehouse_door_id', uniqueReferenceIds)
          .whereNull('warehouse_door_product_lot_assignments.effective_to')
          .select('warehouse_door_product_lot_assignments.warehouse_door_id as id')
        break
      case 'TRUCK':
        query
          .join(
            'discharge_truck_assignments',
            'discharge_truck_assignments.discharge_id',
            'discharges.id',
          )
          .whereIn('discharge_truck_assignments.truck_id', uniqueReferenceIds)
          .whereNull('discharge_truck_assignments.released_at')
          .select('discharge_truck_assignments.truck_id as id')
        break
      default: {
        const exhaustive: never = referenceType
        throw new Error(`Unsupported site reference type: ${exhaustive}`)
      }
    }
    const rows = await query.distinct()
    return new Set(
      rows.map((row) => row.id as string).sort((left, right) => left.localeCompare(right)),
    )
  }
}
