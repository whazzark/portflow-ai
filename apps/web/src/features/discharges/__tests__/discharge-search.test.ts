import { describe, expect, test } from 'vitest'

import { dischargeMatchesSearch } from '@/features/discharges/discharge-search'
import { DISCHARGES } from './support/fixtures'

const oceanCedar = DISCHARGES.find((discharge) => discharge.vesselName === 'MV Ocean Cedar')
const balticStar = DISCHARGES.find((discharge) => discharge.vesselName === 'MV Baltic Star')

if (!oceanCedar || !balticStar) {
  throw new Error('fixture drift: expected MV Ocean Cedar and MV Baltic Star')
}

describe('dischargeMatchesSearch', () => {
  test('matches every field the browsing screen searches', () => {
    expect(dischargeMatchesSearch(oceanCedar, 'ocean')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, '9410002')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, 'Quai Est')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, 'Soufflet')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, 'Orge')).toBe(true)
  })

  test('ignores letter case, surrounding whitespace, and diacritics', () => {
    expect(dischargeMatchesSearch(oceanCedar, 'OCEAN')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, '   ocean   ')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, 'negoce')).toBe(true)
    expect(dischargeMatchesSearch(oceanCedar, 'fourragere')).toBe(true)
  })

  test('treats an empty or whitespace-only query as no search', () => {
    expect(dischargeMatchesSearch(balticStar, '')).toBe(true)
    expect(dischargeMatchesSearch(balticStar, '     ')).toBe(true)
  })

  test('does not match an unrelated term', () => {
    expect(dischargeMatchesSearch(oceanCedar, 'zzzz')).toBe(false)
  })

  test('survives a discharge with no product lot and no IMO', () => {
    expect(dischargeMatchesSearch(balticStar, 'baltic')).toBe(true)
    expect(dischargeMatchesSearch(balticStar, 'cargill')).toBe(false)
  })

  test('matches a discharge once even when several of its lots match', () => {
    const matches = DISCHARGES.filter((discharge) => dischargeMatchesSearch(discharge, 'Cargill'))
    const ids = new Set(matches.map((discharge) => discharge.id))

    expect(matches).toHaveLength(ids.size)
    expect(matches.some((discharge) => discharge.id === oceanCedar.id)).toBe(true)
  })
})
