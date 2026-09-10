import type { DischargeDto } from '@/features/discharges/types'
import { normalizeSearch } from '@/helpers/search'

/**
 * Matches what a user actually remembers about a discharge: its vessel, where it berthed, whose
 * material it carried, and what that material was. A discharge matching through several of its
 * lots still matches once — this answers "does it match", never "how often".
 */
export function dischargeMatchesSearch(discharge: DischargeDto, search: string) {
  const normalizedSearch = normalizeSearch(search)

  if (!normalizedSearch) {
    return true
  }

  const haystack = [
    discharge.vesselName,
    discharge.vesselImo,
    discharge.dock.name,
    ...discharge.productLots.flatMap((productLot) => [
      productLot.customerName,
      productLot.productName,
    ]),
  ]

  return haystack.some(
    (value) => value !== null && normalizeSearch(value).includes(normalizedSearch),
  )
}
