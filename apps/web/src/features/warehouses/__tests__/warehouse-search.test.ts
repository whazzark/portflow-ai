import { describe, expect, test } from 'vitest'
import type {
  WarehouseDoorDto,
  WarehouseDto,
  WarehouseWithDoorsDto,
} from '@/features/warehouses/types'
import {
  describeDoorSummary,
  normalizeWarehouseSearch,
  presentWarehouses,
  searchWarehousesAndDoors,
} from '@/features/warehouses/warehouse-search'
import { doorLifecycle, warehouseLifecycle } from './support/fixtures'

const warehouse = (name: string, status: WarehouseDto['status']): WarehouseDto => ({
  id: name,
  name,
  status,
  ...warehouseLifecycle(),
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

describe('search across warehouses and doors', () => {
  const door = (
    name: string,
    status: WarehouseDoorDto['status'] = 'AVAILABLE',
  ): WarehouseDoorDto => ({
    id: `door-${name}`,
    name,
    status,
    latitude: 1.5,
    longitude: 2.5,
    ...doorLifecycle(),
  })
  const withDoors = (
    name: string,
    status: WarehouseDto['status'],
    doors: WarehouseDoorDto[],
  ): WarehouseWithDoorsDto => ({ ...warehouse(name, status), doors })

  const site = [
    withDoors('Hangar Chef de Baie', 'AVAILABLE', [door('Porte Nord'), door('Porte Est')]),
    withDoors('SICA Atlantique', 'AVAILABLE', [
      door('Porte Chef de Baie'),
      door('Porte Ouest', 'ARCHIVED'),
    ]),
    withDoors('Hangar 7', 'ARCHIVED', [door('Porte Chef', 'ARCHIVED')]),
  ]

  test('matches warehouse and door names ignoring case and accents', () => {
    const results = searchWarehousesAndDoors(site, 'available', 'CHÈF')

    expect(results.warehouses.map((result) => result.name)).toEqual(['Hangar Chef de Baie'])
    expect(results.doors.map((result) => result.name)).toEqual(['Porte Chef de Baie'])
    expect(results.doors[0]).toMatchObject({ warehouseName: 'SICA Atlantique' })
    expect(results.isEmpty).toBe(false)
  })

  test('searches only the selected statuses, doors through their own and their warehouse status', () => {
    expect(searchWarehousesAndDoors(site, 'available', 'porte ouest').doors).toEqual([])
    expect(searchWarehousesAndDoors(site, 'all', 'porte ouest').doors).toHaveLength(1)
    expect(searchWarehousesAndDoors(site, 'archived', 'hangar').warehouses).toHaveLength(1)
    expect(searchWarehousesAndDoors(site, 'archived', 'porte chef').doors).toEqual([
      expect.objectContaining({ name: 'Porte Chef', warehouseName: 'Hangar 7' }),
    ])
  })

  test('orders each group by name', () => {
    const results = searchWarehousesAndDoors(site, 'available', 'porte')

    expect(results.doors.map((result) => result.name)).toEqual([
      'Porte Chef de Baie',
      'Porte Est',
      'Porte Nord',
    ])
  })

  test('summarises each warehouse result’s doors', () => {
    const results = searchWarehousesAndDoors(site, 'all', 'a')
    const summary = (name: string) =>
      results.warehouses.find((result) => result.name === name)?.doorSummary

    expect(summary('Hangar Chef de Baie')).toBe('2 doors')
    expect(summary('SICA Atlantique')).toBe('2 doors · 1 archived')
    expect(summary('Hangar 7')).toBe('1 door · 1 archived')
  })

  test('reports an empty search only for non-blank text', () => {
    expect(searchWarehousesAndDoors(site, 'available', 'hangar 9').isEmpty).toBe(true)
    expect(searchWarehousesAndDoors(site, 'available', '   ')).toEqual({
      warehouses: [],
      doors: [],
      isEmpty: false,
    })
  })

  test('describes a warehouse without doors', () => {
    expect(describeDoorSummary([])).toBe('No doors')
  })
})
