export type WarehouseDoorLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
  warehouseId: string
}

export type BulkWarehouseDoorLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' | 'WAREHOUSE_ARCHIVED'
}

/**
 * `usedIds` holds the doors a Planned or Active Discharge currently relies on, read from the shared
 * site-reference usage rule (`#240` FR-006) inside the write transaction.
 *
 * `availableWarehouseIds` holds the containing warehouses that are `AVAILABLE`, read under the same
 * lock the write takes. A door is a part of its warehouse: whichever direction the transition goes,
 * it may only be moved while that warehouse is available, which is the rule the single-door path
 * enforces with its guarded `WAREHOUSE_ARCHIVED` read. Cascade archival normally makes an available
 * door under an archived warehouse impossible, so this answers a crafted submission rather than an
 * ordinary one — the reason the single path guards it too.
 *
 * A door *already archived* with its warehouse is answered `ALREADY_ARCHIVED` instead, which comes
 * first below: it is both true and the remedy the administrator can act on, and this is the one
 * point where the bulk path deliberately reads better than the single one.
 *
 * `expectedStatus` and the `ALREADY_AVAILABLE` reason are unreachable from archival; they exist so
 * warehouse-door reactivation (#216) reuses this helper rather than writing a second one — the same
 * shape the dock and warehouse helpers already carry.
 */
export function findBulkBlockers(
  ids: string[],
  doorsById: Map<string, WarehouseDoorLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  availableWarehouseIds: Set<string>,
  usedIds: Set<string> = new Set(),
): BulkWarehouseDoorLifecycleBlocker[] {
  return ids.flatMap((id): BulkWarehouseDoorLifecycleBlocker[] => {
    const door = doorsById.get(id)

    if (!door) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (door.status !== expectedStatus) {
      return [
        {
          id,
          name: door.name,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (!availableWarehouseIds.has(door.warehouseId)) {
      return [{ id, name: door.name, reason: 'WAREHOUSE_ARCHIVED' }]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [{ id, name: door.name, reason: 'IN_USE' }]
    }

    return []
  })
}
