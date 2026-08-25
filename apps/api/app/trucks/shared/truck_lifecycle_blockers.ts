import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'

export type TruckLifecycleRecord = {
  id: string
  registration: string
  status: 'AVAILABLE' | 'ARCHIVED'
  transportCompanyId: string
}

export type BulkTruckLifecycleBlocker = {
  id: string
  registration?: string
  reason:
    | 'NOT_FOUND'
    | 'IN_USE'
    | 'ALREADY_ARCHIVED'
    | 'ALREADY_AVAILABLE'
    | 'TRANSPORT_COMPANY_ARCHIVED'
}

export const indexTrucksById = indexById
export const orderTrucks = orderByIds

export function findBulkBlockers(
  ids: string[],
  trucksById: Map<string, TruckLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
  archivedCompanyIds: Set<string> = new Set(),
): BulkTruckLifecycleBlocker[] {
  return ids.flatMap((id): BulkTruckLifecycleBlocker[] => {
    const truck = trucksById.get(id)

    if (!truck) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (truck.status !== expectedStatus) {
      return [
        {
          id,
          registration: truck.registration,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [{ id, registration: truck.registration, reason: 'IN_USE' }]
    }

    if (expectedStatus === 'ARCHIVED' && archivedCompanyIds.has(truck.transportCompanyId)) {
      return [{ id, registration: truck.registration, reason: 'TRANSPORT_COMPANY_ARCHIVED' }]
    }

    return []
  })
}
