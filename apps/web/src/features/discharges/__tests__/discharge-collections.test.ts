import { describe, expect, test } from 'vitest'

import { groupByStatus, orderForStatus } from '@/features/discharges/discharge-collections'
import type { DischargeDto } from '@/features/discharges/types'
import { DISCHARGES } from './support/fixtures'

function vesselNames(discharges: DischargeDto[]) {
  return discharges.map((discharge) =>
    `${discharge.vesselName} ${discharge.vesselImo ?? ''}`.trim(),
  )
}

describe('groupByStatus', () => {
  test('partitions the collection with nothing missing and nothing duplicated', () => {
    const collections = groupByStatus(DISCHARGES)
    const total = collections.planned.length + collections.active.length + collections.closed.length

    expect(collections.planned).toHaveLength(2)
    expect(collections.active).toHaveLength(1)
    expect(collections.closed).toHaveLength(2)
    expect(total).toBe(DISCHARGES.length)
  })

  test('returns every status as an empty collection for an empty site', () => {
    const collections = groupByStatus([])

    expect(collections.planned).toEqual([])
    expect(collections.active).toEqual([])
    expect(collections.closed).toEqual([])
  })
})

describe('orderForStatus', () => {
  test('reads planned and active discharges soonest first', () => {
    const collections = groupByStatus(DISCHARGES)

    expect(vesselNames(orderForStatus(collections.planned, 'planned'))).toEqual([
      'MV Baltic Star',
      'MV Atlantic Dawn 9410001',
    ])
    expect(orderForStatus(collections.active, 'active')).toHaveLength(1)
  })

  test('reads closed discharges most recent first', () => {
    const collections = groupByStatus(DISCHARGES)

    expect(vesselNames(orderForStatus(collections.closed, 'closed'))).toEqual([
      'MV Loire Star 9410003',
      'MV Loire Star 9410004',
    ])
  })

  test('breaks a tie on identity so the order is stable in both directions', () => {
    const tied: DischargeDto[] = [
      { ...DISCHARGES[0], id: 'bbbb', expectedStartAt: '2026-06-01T00:00:00.000Z' },
      { ...DISCHARGES[0], id: 'aaaa', expectedStartAt: '2026-06-01T00:00:00.000Z' },
    ]

    expect(orderForStatus(tied, 'planned').map((discharge) => discharge.id)).toEqual([
      'aaaa',
      'bbbb',
    ])
    expect(orderForStatus(tied, 'closed').map((discharge) => discharge.id)).toEqual([
      'aaaa',
      'bbbb',
    ])
  })
})
