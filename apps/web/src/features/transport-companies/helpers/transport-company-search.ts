import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { normalizeSearch } from '@/helpers/search'

export function transportCompanyMatchesSearch(company: TransportCompanyDto, search: string) {
  const normalizedSearch = normalizeSearch(search.trim())

  return !normalizedSearch || normalizeSearch(company.name).includes(normalizedSearch)
}
