import { expect, test } from 'vitest'

import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/helpers/dates'

const pad = (value: number) => String(value).padStart(2, '0')

test('renders an instant as the local date and time a datetime-local input holds', () => {
  const instant = new Date('2026-10-01T04:00:00.000Z')
  const expected = `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}T${pad(instant.getHours())}:${pad(instant.getMinutes())}`

  expect(toDateTimeLocalValue('2026-10-01T04:00:00.000Z')).toBe(expected)
})

test('turns a local date and time into an ISO instant with an explicit offset', () => {
  const iso = fromDateTimeLocalValue('2026-10-01T06:00')

  expect(iso).toMatch(/^2026-10-01T06:00:00\.000[+-]\d{2}:\d{2}$/)
  expect(new Date(iso as string).getTime()).toBe(new Date(2026, 9, 1, 6, 0).getTime())
})

test('round-trips between the two representations', () => {
  const iso = fromDateTimeLocalValue('2026-12-24T23:45') as string

  expect(toDateTimeLocalValue(iso)).toBe('2026-12-24T23:45')
})

test('returns null for an empty or invalid local value', () => {
  expect(fromDateTimeLocalValue('')).toBeNull()
  expect(fromDateTimeLocalValue('not-a-date')).toBeNull()
})
