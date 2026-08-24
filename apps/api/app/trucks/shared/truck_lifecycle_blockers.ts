import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'

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

export const indexTrucksById = indexById
export const orderTrucks = orderByIds

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
