export type WarehouseLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkWarehouseLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

/**
 * `usedIds` holds the warehouses whose doors currently block archival, already projected from the
 * door-level usage rule (`#240` FR-006) onto their containing warehouses. Warehouses have no
 * discharge relationship of their own, so this is the only way one can be in use.
 *
 * `expectedStatus` and the `ALREADY_AVAILABLE` reason are unreachable from archival; they exist so
 * warehouse reactivation (#211) reuses this helper rather than writing a second one.
 */
export function findBulkBlockers(
  ids: string[],
  warehousesById: Map<string, WarehouseLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
): BulkWarehouseLifecycleBlocker[] {
  return ids.flatMap((id): BulkWarehouseLifecycleBlocker[] => {
    const warehouse = warehousesById.get(id)

    if (!warehouse) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (warehouse.status !== expectedStatus) {
      return [
        {
          id,
          name: warehouse.name,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [{ id, name: warehouse.name, reason: 'IN_USE' }]
    }

    return []
  })
}
