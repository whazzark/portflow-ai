import vine from '@vinejs/vine'
import { DateTime } from 'luxon'

/**
 * An instant must say which point in time it means. Without an offset the same wall time would be
 * read in the server's zone, which is not necessarily the zone the user entered it in.
 */
const EXPLICIT_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/

const isoInstant = vine.createRule(
  (value, _options, field) => {
    if (typeof value !== 'string') {
      return
    }

    if (!EXPLICIT_OFFSET.test(value) || !DateTime.fromISO(value, { setZone: true }).isValid) {
      field.report(
        'The {{ field }} field must be an ISO 8601 date and time with an offset',
        'instant',
        field,
      )
    }
  },
  { name: 'instant' },
)

export const instant = () => vine.string().use(isoInstant())

/**
 * The accepted instant in UTC. Timestamp columns store no zone, and the application writes them in
 * UTC, so an instant kept in the offset it was entered with would be stored as the wrong time.
 */
export function parseInstant(value: string) {
  return DateTime.fromISO(value, { setZone: true }).toUTC()
}
