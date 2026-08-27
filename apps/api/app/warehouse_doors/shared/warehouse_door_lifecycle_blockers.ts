export type WarehouseDoorLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkWarehouseDoorLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

/**
 * `usedIds` holds the doors a Planned or Active Discharge currently relies on, read from the shared
 * site-reference usage rule (`#240` FR-006) inside the write transaction.
 *
 * A door whose containing warehouse is archived needs no reason of its own: archiving a warehouse
 * cascades onto its available doors, so such a door is already `ARCHIVED` and is reported as
 * `ALREADY_ARCHIVED`, which is both true and the remedy the administrator can act on.
 *
 * `expectedStatus` and the `ALREADY_AVAILABLE` reason are unreachable from archival; they exist so
 * warehouse-door reactivation (#216) reuses this helper rather than writing a second one — the same
 * shape the dock and warehouse helpers already carry.
 */
export function findBulkBlockers(
  ids: string[],
  doorsById: Map<string, WarehouseDoorLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
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

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [{ id, name: door.name, reason: 'IN_USE' }]
    }

    return []
  })
}
