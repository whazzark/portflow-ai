import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { normalizeSearch } from '@/helpers/search'

export function normalizeTruckSearch(search: string) {
  return normalizeSearch(search.trim())
}

export function truckMatchesSearch(
  truck: TruckDto,
  company: TransportCompanyDto | undefined,
  search: string,
) {
  const normalizedSearch = normalizeTruckSearch(search)

  return (
    !normalizedSearch ||
    normalizeSearch(truck.registration).includes(normalizedSearch) ||
    normalizeSearch(company?.name ?? '').includes(normalizedSearch)
  )
}
