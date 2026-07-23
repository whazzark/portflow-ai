import type { CustomerDto } from '@/features/customers/types'
import { normalizeSearch } from '@/helpers/search'

export function customerMatchesSearch(customer: CustomerDto, search: string) {
  const normalizedSearch = normalizeSearch(search)

  if (!normalizedSearch) {
    return true
  }

  return [customer.code, customer.companyName].some((value) =>
    normalizeSearch(value).includes(normalizedSearch),
  )
}
