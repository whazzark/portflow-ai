import { describe, expect, test } from 'vitest'
import { countResources, normalizeResourceSearch, presentResources } from './resource-map-search'

const resources = [
  { name: 'Quai d’Été', status: 'AVAILABLE' as const },
  { name: 'Retired Yard', status: 'ARCHIVED' as const },
]

describe('resource map presentation', () => {
  test('normalizes accents and whitespace consistently', () => {
    expect(normalizeResourceSearch('  QUAI D’ÉTÉ  ')).toBe('quai d’ete')
  })

  test('filters status while preserving search context markers', () => {
    expect(presentResources(resources, 'available', 'retired')).toEqual([
      { ...resources[0], isSearchMatch: false },
    ])
  })

  test('derives lifecycle counts from the collection', () => {
    expect(countResources(resources)).toEqual({ all: 2, available: 1, archived: 1 })
  })
})
