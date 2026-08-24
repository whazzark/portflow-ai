export type TransportCompanyLifecycleRecord = {
  id: string
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
}

export type BulkTransportCompanyLifecycleBlocker = {
  id: string
  name?: string
  reason: 'NOT_FOUND' | 'ALREADY_ARCHIVED' | 'HAS_AVAILABLE_TRUCKS'
}

export function indexCompaniesById<T extends TransportCompanyLifecycleRecord>(
  companies: T[],
): Map<string, T> {
  return new Map(companies.map((company) => [company.id, company]))
}

export function findBulkArchiveBlockers(
  ids: string[],
  companiesById: Map<string, TransportCompanyLifecycleRecord>,
  companyIdsWithAvailableTrucks: Set<string>,
): BulkTransportCompanyLifecycleBlocker[] {
  return ids.flatMap((id): BulkTransportCompanyLifecycleBlocker[] => {
    const company = companiesById.get(id)

    if (!company) {
      return [{ id, reason: 'NOT_FOUND' }]
    }

    if (company.status === 'ARCHIVED') {
      return [{ id, name: company.name, reason: 'ALREADY_ARCHIVED' }]
    }

    if (companyIdsWithAvailableTrucks.has(id)) {
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
