export function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB') : '—'
}

const pad = (value: number) => String(value).padStart(2, '0')

/**
 * Date and time entry happens in the browser's zone, the same zone `formatDateTime` displays in,
 * so what a user types is what they later read. The API receives the instant with its offset.
 */
export function toDateTimeLocalValue(iso: string | null) {
  if (!iso) {
    return ''
  }

  const date = new Date(iso)

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocalValue(local: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!match) {
    return null
  }

  const [, year, month, day, hours, minutes] = match.map(Number)
  const date = new Date(year, month - 1, day, hours, minutes)
  // A value the calendar rolled over, such as 30 February, is not the date the user entered.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absolute = Math.abs(offsetMinutes)

  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00.000${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}
