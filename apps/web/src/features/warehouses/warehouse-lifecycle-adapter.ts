import type { BulkLifecycleOutcome } from '@/components/resource-map/bulk-resource-lifecycle-actions'
import type {
  BulkWarehouseLifecycleResult,
  WarehouseWithDoorsDto,
} from '@/features/warehouses/types'

export function toBulkLifecycleOutcome(result: BulkWarehouseLifecycleResult): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedWarehouses.length,
    blocked: result.blockedWarehouses,
  }
}

/** Total available doors across a selection, for the bulk confirmation. Advisory in exactly the
 * same way the single dialog's count is: the authoritative set is assessed at submission time. */
export function countAvailableDoorsIn(warehouses: WarehouseWithDoorsDto[]) {
  return warehouses.reduce(
    (total, warehouse) =>
      total + (warehouse.doors ?? []).filter((door) => door.status === 'AVAILABLE').length,
    0,
  )
}

export function describeBulkDoorCascade(warehouseCount: number, availableDoors: number) {
  // Both counts vary independently and either can be 1, so every clause agrees on its own subject
  // rather than borrowing the door count's number for the warehouse sentence.
  const oneWarehouse = warehouseCount === 1
  const subject = oneWarehouse ? 'This 1 warehouse' : `These ${warehouseCount} warehouses`
  const lead = `${subject} ${oneWarehouse ? 'remains' : 'remain'} readable but ${oneWarehouse ? 'is' : 'are'} no longer selectable for new operational work.`
  const them = oneWarehouse ? 'it' : 'them'

  if (availableDoors === 0) {
    return `${lead} ${oneWarehouse ? 'It has' : 'They have'} no available door to archive with ${them}.`
  }

  const doors =
    availableDoors === 1 ? '1 available door is' : `${availableDoors} available doors are`

  return `${lead} ${oneWarehouse ? 'Its' : 'Their'} ${doors} archived with ${them}.`
}
