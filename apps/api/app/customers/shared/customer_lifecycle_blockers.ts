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

export function indexCustomersById<T extends CustomerLifecycleRecord>(
  customers: T[],
): Map<string, T> {
  return new Map(customers.map((customer) => [customer.id, customer]))
}

export function findBulkBlockers(
  ids: string[],
  customersById: Map<string, CustomerLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
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

    return []
  })
}

export function orderCustomers<T extends { id: string }>(
  ids: string[],
  customersById: Map<string, T>,
): T[] {
  return ids.flatMap((id) => {
    const customer = customersById.get(id)
    return customer ? [customer] : []
  })
}
