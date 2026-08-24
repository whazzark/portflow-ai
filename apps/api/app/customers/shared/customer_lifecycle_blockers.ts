import { indexById, orderByIds } from '#shared/lifecycle/bulk_lifecycle_records'

export type CustomerLifecycleRecord = {
  id: string
  code: string
  companyName: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkCustomerLifecycleBlocker = {
  id: string
  code?: string
  companyName?: string
  reason: 'NOT_FOUND' | 'IN_USE' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE'
}

export const indexCustomersById = indexById
export const orderCustomers = orderByIds

export function findBulkBlockers(
  ids: string[],
  customersById: Map<string, CustomerLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  usedIds: Set<string> = new Set(),
): BulkCustomerLifecycleBlocker[] {
  return ids.flatMap((id): BulkCustomerLifecycleBlocker[] => {
    const customer = customersById.get(id)

    if (!customer) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (customer.status !== expectedStatus) {
      return [
        {
          id,
          code: customer.code,
          companyName: customer.companyName,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && usedIds.has(id)) {
      return [
        {
          id,
          code: customer.code,
          companyName: customer.companyName,
          reason: 'IN_USE',
        },
      ]
    }

    return []
  })
}
