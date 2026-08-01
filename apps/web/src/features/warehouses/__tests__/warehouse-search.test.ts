import { describe, expect, test } from 'vitest'
import type { WarehouseDto } from '@/features/warehouses/types'
import { normalizeWarehouseSearch, presentWarehouses } from '@/features/warehouses/warehouse-search'

const warehouse = (name: string, status: WarehouseDto['status']): WarehouseDto => ({
  id: name,
  name,
  status,
  footprint: {
    points: [
      { latitude: 1, longitude: 2 },
      { latitude: 1, longitude: 3 },
      { latitude: 2, longitude: 2 },
    ],
  },
})

describe('warehouse search', () => {
  test('normalizes accents and case', () =>
    expect(normalizeWarehouseSearch('  Étage  ')).toBe('etage'))
  test('filters lifecycle and marks search matches', () => {
    const result = presentWarehouses(
      [warehouse('North Shed', 'AVAILABLE'), warehouse('Old Store', 'ARCHIVED')],
      'available',
      'north',
    )
    expect(result).toHaveLength(1)
    expect(result[0].isSearchMatch).toBe(true)
  })
})
