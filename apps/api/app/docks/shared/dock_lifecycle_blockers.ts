export type DockLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkDockLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export function indexDocksById<T extends DockLifecycleRecord>(docks: T[]): Map<string, T> {
  return new Map(docks.map((dock) => [dock.id, dock]))
}

export function findBulkBlockers(
  ids: string[],
  docksById: Map<string, DockLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
): BulkDockLifecycleBlocker[] {
  return ids.flatMap((id): BulkDockLifecycleBlocker[] => {
    const dock = docksById.get(id)

    if (!dock) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (dock.status !== expectedStatus) {
      return [
        {
          id,
          name: dock.name,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [
        {
          id,
          name: dock.name,
          reason: 'IN_USE',
        },
      ]
    }

    return []
  })
}

export function orderDocks<T extends { id: string }>(
  ids: string[],
  docksById: Map<string, T>,
): T[] {
  return ids.flatMap((id) => {
    const dock = docksById.get(id)
    return dock ? [dock] : []
  })
}
