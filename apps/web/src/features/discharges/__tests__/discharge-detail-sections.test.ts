import { describe, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '@/features/discharges/__tests__/support/fixtures'
import {
  detailTabCounts,
  isDischargeDetailTab,
  preparationSummary,
  tabSearch,
} from '@/features/discharges/discharge-detail-sections'

const planned = listedDischarge('MV Atlantic Dawn', 'PLANNED')
const closed = listedDischarge('MV Loire Star', 'CLOSED')

const HELD = buildPoolEntry({ id: 'pool-held', truckId: 'truck-held' })
const RELEASED = buildPoolEntry({
  id: 'pool-released',
  truckId: 'truck-released',
  releasedAt: '2026-09-08T08:00:00.000Z',
})

const truckRow = (truckId: string, effectiveTo: string | null = null) => ({
  id: `row-${truckId}`,
  truckId,
  registration: truckId,
  truckStatus: 'AVAILABLE' as const,
  effectiveFrom: '2026-09-07T08:00:00.000Z',
  effectiveTo,
})

describe('isDischargeDetailTab', () => {
  test('accepts the four sections only', () => {
    expect(isDischargeDetailTab('truck-pool')).toBe(true)
    expect(isDischargeDetailTab('trucks')).toBe(false)
  })
})

describe('tabSearch', () => {
  test('leaves the default section out of the address', () => {
    expect(tabSearch('overview')).toEqual({ tab: undefined })
    expect(tabSearch('shifts')).toEqual({ tab: 'shifts' })
  })
})

describe('detailTabCounts', () => {
  test('counts the lots, the trucks still held, and the shifts', () => {
    const detail = buildDischargeDetail(planned, {
      productLots: [buildLot({ id: 'lot-1' }), buildLot({ id: 'lot-2' })],
      shifts: [buildShift()],
      truckPool: [HELD, RELEASED],
    })

    expect(detailTabCounts(detail)).toEqual({ 'product-lots': 2, 'truck-pool': 1, shifts: 1 })
  })

  test('gives a closed pool no count, since it holds nothing and lists only history', () => {
    const detail = buildDischargeDetail(closed, { truckPool: [HELD, RELEASED] })

    expect(detailTabCounts(detail)['truck-pool']).toBeNull()
  })
})

describe('preparationSummary', () => {
  test('counts the lots without a warehouse door in effect', () => {
    const detail = buildDischargeDetail(planned, {
      productLots: [
        buildLot({ id: 'never' }),
        buildLot({
          id: 'ended',
          doorAssignments: [buildDoorPeriod({ effectiveTo: '2026-09-09T08:00:00.000Z' })],
        }),
        buildLot({ id: 'current', doorAssignments: [buildDoorPeriod()] }),
      ],
    })

    expect(preparationSummary(detail).productLots).toEqual({ total: 3, withoutCurrentDoor: 2 })
  })

  test('counts only the trucks the pool still holds', () => {
    const detail = buildDischargeDetail(planned, { truckPool: [HELD, RELEASED] })

    expect(preparationSummary(detail).truckPool).toEqual({ held: 1 })
  })

  test('counts the planned shifts with no truck in effect', () => {
    const detail = buildDischargeDetail(planned, {
      shifts: [
        buildShift({ id: 'none' }),
        buildShift({ id: 'ended', trucks: [truckRow('truck-a', '2026-09-09T08:00:00.000Z')] }),
        buildShift({
          id: 'suspended',
          trucks: [{ ...truckRow('truck-b'), truckStatus: 'SUSPENDED' }],
        }),
        buildShift({ id: 'active', status: 'ACTIVE' }),
      ],
    })

    expect(preparationSummary(detail).shifts).toEqual({ total: 4, plannedWithoutTrucks: 2 })
  })
})
