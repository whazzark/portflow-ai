import {
  DISCHARGE_STATUS_BY_FILTER,
  DISCHARGE_STATUS_FILTERS,
  type DischargeDto,
  type DischargeStatusFilter,
} from '@/features/discharges/types'

export type DischargeCollections = Record<DischargeStatusFilter, DischargeDto[]>

/**
 * Splits the single collection the API returns into the three tabs. Counting happens here, before
 * any search runs, so a tab's badge keeps answering "how much work is in this status" rather than
 * "how much of it did you just type past".
 */
export function groupByStatus(discharges: DischargeDto[]): DischargeCollections {
  const collections = Object.fromEntries(
    DISCHARGE_STATUS_FILTERS.map((filter) => [filter, [] as DischargeDto[]]),
  ) as DischargeCollections

  for (const discharge of discharges) {
    for (const filter of DISCHARGE_STATUS_FILTERS) {
      if (discharge.status === DISCHARGE_STATUS_BY_FILTER[filter]) {
        collections[filter].push(discharge)
      }
    }
  }

  return collections
}

/**
 * The direction each tab reads: planned and active look forward to the next start, closed looks
 * back at the most recent one. The identity tie-break stays ascending in both directions, so two
 * discharges expected at the same minute never swap places when the direction flips.
 */
export function orderForStatus(
  discharges: DischargeDto[],
  status: DischargeStatusFilter,
): DischargeDto[] {
  const descending = status === 'closed'

  return [...discharges].sort((left, right) => {
    // The column is NOT NULL, but the generated transport type still admits null, so the
    // comparison coerces rather than asserting an invariant the type does not carry.
    const byExpectedStart = (left.expectedStartAt ?? '').localeCompare(right.expectedStartAt ?? '')

    if (byExpectedStart !== 0) {
      return descending ? -byExpectedStart : byExpectedStart
    }

    return left.id.localeCompare(right.id)
  })
}
