import { describe, expect, test } from 'vitest'
import { TRANSPORT_COMPANIES } from '@/features/transport-companies/__tests__/support/fixtures'
import { TRUCKS } from '@/features/trucks/__tests__/support/fixtures'
import { normalizeTruckSearch, truckMatchesSearch } from '@/features/trucks/helpers/truck-search'

describe('truck search', () => {
  test('trims and removes case and diacritic differences', () => {
    expect(normalizeTruckSearch('  BÊTA  ')).toBe('beta')
  })

  test('matches registration or current transport-company name', () => {
    expect(truckMatchesSearch(TRUCKS[0], TRANSPORT_COMPANIES[0], ' aa-101 ')).toBe(true)
    expect(truckMatchesSearch(TRUCKS[1], TRANSPORT_COMPANIES[1], 'beta log')).toBe(true)
    expect(truckMatchesSearch(TRUCKS[2], TRANSPORT_COMPANIES[2], 'missing')).toBe(false)
  })

  test('treats whitespace-only input as no search', () => {
    expect(TRUCKS.every((truck) => truckMatchesSearch(truck, undefined, '   '))).toBe(true)
  })
})
