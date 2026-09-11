import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'

type DischargeStatus = DischargeDetailDto['status']

// The transport types every date as nullable, although an effective start never is in the column.
type Period = { effectiveFrom: string | null; effectiveTo: string | null }

/**
 * An assignment or a membership is in effect while its period has no end and its discharge is
 * still planned or active — the same two conditions the site-reference archival guards apply, so
 * the page never claims a discharge holds a resource those guards consider free. A closed
 * discharge holds nothing, even where one of its periods was left without an end.
 */
export function isInEffect(period: Pick<Period, 'effectiveTo'>, dischargeStatus: DischargeStatus) {
  return dischargeStatus !== 'CLOSED' && period.effectiveTo === null
}

/** Every period stays its own entry; this only decides which group it is read in. */
export function splitPeriods<T extends Pick<Period, 'effectiveTo'>>(
  periods: T[],
  dischargeStatus: DischargeStatus,
) {
  return {
    inEffect: periods.filter((period) => isInEffect(period, dischargeStatus)),
    ended: periods.filter((period) => !isInEffect(period, dischargeStatus)),
  }
}

export type LotDoorNotice = 'NONE_ASSIGNED' | 'NONE_CURRENTLY_ASSIGNED'

/**
 * What a lot says about its doors beyond listing them. A closed discharge holds no door any more,
 * so its ended periods are history rather than a gap worth pointing out.
 */
export function lotDoorNotice(
  lot: { doorAssignments: Pick<Period, 'effectiveTo'>[] },
  dischargeStatus: DischargeStatus,
): LotDoorNotice | null {
  if (lot.doorAssignments.length === 0) {
    return 'NONE_ASSIGNED'
  }

  if (
    dischargeStatus === 'CLOSED' ||
    lot.doorAssignments.some((period) => isInEffect(period, dischargeStatus))
  ) {
    return null
  }

  return 'NONE_CURRENTLY_ASSIGNED'
}

const WHOLE_TONNES = new Intl.NumberFormat('en-GB')

/**
 * A fixed-3 decimal string as tonnes. The value never goes through a number: the whole part is
 * grouped as an integer and the three decimals are kept as sent. Belongs in `helpers/` once a
 * second feature displays tonnes.
 */
export function formatTonnes(value: string) {
  const [whole, decimals = '000'] = value.split('.')

  return `${WHOLE_TONNES.format(BigInt(whole))}.${decimals} t`
}

export function formatPeriod(period: Period, dischargeStatus: DischargeStatus) {
  if (isInEffect(period, dischargeStatus)) {
    return `Since ${formatDateTime(period.effectiveFrom)}`
  }

  // A closed discharge's period left open has ended without an end on record; saying so is
  // truer than presenting it as current or inventing a date.
  const end = period.effectiveTo === null ? 'end not recorded' : formatDateTime(period.effectiveTo)

  return `${formatDateTime(period.effectiveFrom)} – ${end}`
}
