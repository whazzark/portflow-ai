export type TransportCompanyLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkTransportCompanyLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'ALREADY_AVAILABLE' | 'HAS_AVAILABLE_TRUCKS'
}

export function indexCompaniesById<T extends TransportCompanyLifecycleRecord>(
  companies: T[],
): Map<string, T> {
  return new Map(companies.map((company) => [company.id, company]))
}

/**
 * Partitions a requested selection against one lifecycle direction. `expectedStatus` is the
 * status a company must already have for the transition to be eligible: `AVAILABLE` for archival,
 * `ARCHIVED` for reactivation. `companyIdsWithAvailableTrucks` is consulted only when `AVAILABLE`
 * is expected — reactivation has no truck-based blocker, so its default (empty) makes that branch
 * unreachable by construction rather than by convention.
 */
export function findBulkBlockers(
  ids: string[],
  companiesById: Map<string, TransportCompanyLifecycleRecord>,
  expectedStatus: 'AVAILABLE' | 'ARCHIVED',
  companyIdsWithAvailableTrucks: Set<string> = new Set(),
): BulkTransportCompanyLifecycleBlocker[] {
  return ids.flatMap((id): BulkTransportCompanyLifecycleBlocker[] => {
    const company = companiesById.get(id)

    if (!company) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (company.status !== expectedStatus) {
      return [
        {
          id,
          name: company.name,
          reason: expectedStatus === 'AVAILABLE' ? 'ALREADY_ARCHIVED' : 'ALREADY_AVAILABLE',
        },
      ]
    }

    if (expectedStatus === 'AVAILABLE' && companyIdsWithAvailableTrucks.has(id)) {
      return [{ id, name: company.name, reason: 'HAS_AVAILABLE_TRUCKS' }]
    }

    return []
  })
}

export function orderCompanies<T extends { id: string }>(
  ids: string[],
  companiesById: Map<string, T>,
): T[] {
  return ids.flatMap((id) => {
    const company = companiesById.get(id)
    return company ? [company] : []
  })
}
