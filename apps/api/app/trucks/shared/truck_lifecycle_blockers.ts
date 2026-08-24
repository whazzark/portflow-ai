export type TruckLifecycleRecord = {
  id: string
  registration: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkTruckLifecycleBlocker = {
  id: string
  registration?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED'
}

export function indexTrucksById<T extends TruckLifecycleRecord>(trucks: T[]): Map<string, T> {
  return new Map(trucks.map((truck) => [truck.id, truck]))
}

export function findBulkBlockers(
  ids: string[],
  trucksById: Map<string, TruckLifecycleRecord>,
  usedIds: Set<string> = new Set(),
): BulkTruckLifecycleBlocker[] {
  return ids.flatMap((id): BulkTruckLifecycleBlocker[] => {
    const truck = trucksById.get(id)

    if (!truck) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (truck.status !== 'AVAILABLE') {
      return [{ id, registration: truck.registration, reason: 'ALREADY_ARCHIVED' }]
    }

    if (usedIds.has(id)) {
      return [{ id, registration: truck.registration, reason: 'IN_USE' }]
    }

    return []
  })
}

export function orderTrucks<T extends { id: string }>(
  ids: string[],
  trucksById: Map<string, T>,
): T[] {
  return ids.flatMap((id) => {
    const truck = trucksById.get(id)
    return truck ? [truck] : []
  })
}
