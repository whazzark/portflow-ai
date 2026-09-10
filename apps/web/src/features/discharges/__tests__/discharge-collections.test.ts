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

  test('orders by the instant, not the wall clock, across a daylight-saving change', () => {
    // The hour French clocks repeat: 02:30+02:00 is 00:30 UTC, half an hour BEFORE 02:00+01:00,
    // which is 01:00 UTC. Compared as text, the two read in the opposite order.
    const overFallBack: DischargeDto[] = [
      { ...DISCHARGES[0], id: 'later', expectedStartAt: '2026-10-25T02:00:00.000+01:00' },
      { ...DISCHARGES[0], id: 'earlier', expectedStartAt: '2026-10-25T02:30:00.000+02:00' },
    ]

    expect(orderForStatus(overFallBack, 'planned').map((discharge) => discharge.id)).toEqual([
      'earlier',
      'later',
    ])
    expect(orderForStatus(overFallBack, 'closed').map((discharge) => discharge.id)).toEqual([
      'later',
      'earlier',
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
