import type { CustomerDto } from '@/features/customers/types'
import { normalizeSearch } from '@/helpers/search'

export function customerMatchesSearch(customer: CustomerDto, search: string) {
  const normalizedSearch = normalizeSearch(search)

  if (!normalizedSearch) {
    return true
  }

  return [
    customer.code,
    customer.companyName,
    customer.reactivationComment,
    customer.archiveComment,
  ].some((value) => value !== null && normalizeSearch(value).includes(normalizedSearch))
}
