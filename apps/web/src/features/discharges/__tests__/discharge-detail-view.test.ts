import { describe, expect, test } from 'vitest'
import { buildDoorPeriod, buildLot } from '@/features/discharges/__tests__/support/fixtures'
import {
  formatPeriod,
  formatShiftPeriod,
  formatTonnes,
  groupLotsByCustomer,
  isInEffect,
  lotDoorNotice,
  lotRemovalBlock,
  plannedCoverage,
  splitPeriods,
  sumTonnes,
} from '@/features/discharges/discharge-detail-view'
import { formatDateTime } from '@/helpers/dates'

const OPEN = { id: 'open', effectiveFrom: '2026-09-08T05:00:00.000Z', effectiveTo: null }
const ENDED = {
  id: 'ended',
  effectiveFrom: '2026-09-01T05:00:00.000Z',
  effectiveTo: '2026-09-03T17:00:00.000Z',
}

describe('isInEffect', () => {
  test('holds while the period has no end and the discharge is planned or active', () => {
    expect(isInEffect(OPEN, 'PLANNED')).toBe(true)
    expect(isInEffect(OPEN, 'ACTIVE')).toBe(true)
    expect(isInEffect(ENDED, 'ACTIVE')).toBe(false)
  })

  test('never holds for a closed discharge, even when a period was left without an end', () => {
    expect(isInEffect(OPEN, 'CLOSED')).toBe(false)
  })
})

describe('splitPeriods', () => {
  test('separates the periods in effect from the ended ones, keeping each group in order', () => {
    const laterOpen = { ...OPEN, id: 'later-open' }
    const laterEnded = { ...ENDED, id: 'later-ended' }

    expect(splitPeriods([ENDED, OPEN, laterEnded, laterOpen], 'ACTIVE')).toEqual({
      ended: [ENDED, laterEnded],
      inEffect: [OPEN, laterOpen],
    })
  })

  test('puts every period of a closed discharge among the ended ones', () => {
    expect(splitPeriods([ENDED, OPEN], 'CLOSED')).toEqual({ ended: [ENDED, OPEN], inEffect: [] })
  })
})

describe('lotDoorNotice', () => {
  test('says so when the lot has never had a door', () => {
    expect(lotDoorNotice({ doorAssignments: [] }, 'PLANNED')).toBe('NONE_ASSIGNED')
    expect(lotDoorNotice({ doorAssignments: [] }, 'CLOSED')).toBe('NONE_ASSIGNED')
  })

  test('says no door is currently assigned when a live discharge has only ended periods', () => {
    expect(lotDoorNotice({ doorAssignments: [ENDED] }, 'PLANNED')).toBe('NONE_CURRENTLY_ASSIGNED')
    expect(lotDoorNotice({ doorAssignments: [ENDED] }, 'ACTIVE')).toBe('NONE_CURRENTLY_ASSIGNED')
  })

  test('says nothing when a door is in effect', () => {
    expect(lotDoorNotice({ doorAssignments: [ENDED, OPEN] }, 'ACTIVE')).toBeNull()
  })

  test('says nothing about a closed discharge, which holds no door any more', () => {
    expect(lotDoorNotice({ doorAssignments: [ENDED] }, 'CLOSED')).toBeNull()
    expect(lotDoorNotice({ doorAssignments: [OPEN] }, 'CLOSED')).toBeNull()
  })
})

describe('formatTonnes', () => {
  test('groups the whole tonnes and keeps the three decimals verbatim', () => {
    expect(formatTonnes('1234.500')).toBe('1,234.500 t')
    expect(formatTonnes('999999999.999')).toBe('999,999,999.999 t')
    expect(formatTonnes('0.000')).toBe('0.000 t')
  })
})

describe('formatPeriod', () => {
  test('reads a period in effect from its start', () => {
    expect(formatPeriod(OPEN, 'ACTIVE')).toBe(`Since ${formatDateTime(OPEN.effectiveFrom)}`)
  })

  test('reads an ended period from its start to its end', () => {
    expect(formatPeriod(ENDED, 'ACTIVE')).toBe(
      `${formatDateTime(ENDED.effectiveFrom)} – ${formatDateTime(ENDED.effectiveTo)}`,
    )
  })

  test('says so when a closed discharge left a period without an end, rather than inventing one', () => {
    expect(formatPeriod(OPEN, 'CLOSED')).toBe(
      `${formatDateTime(OPEN.effectiveFrom)} – end not recorded`,
    )
  })
})

describe('formatShiftPeriod', () => {
  const local = (day: number, hours: number) => new Date(2026, 9, day, hours).toISOString()

  test('names the day once for a shift within one day', () => {
    expect(formatShiftPeriod({ plannedStartAt: local(4, 6), plannedEndAt: local(4, 14) })).toBe(
      'Sun 4 Oct 06:00 – 14:00',
    )
  })

  test('names both days for a shift worked past midnight', () => {
    expect(formatShiftPeriod({ plannedStartAt: local(4, 22), plannedEndAt: local(5, 6) })).toBe(
      'Sun 4 Oct 22:00 – Mon 5 Oct 06:00',
    )
  })
})

describe('sumTonnes', () => {
  test('adds tonnages exactly, keeping three decimals', () => {
    expect(sumTonnes(['1200.5', '800', '0.001'])).toBe('2000.501')
    expect(sumTonnes(['0.1', '0.2'])).toBe('0.300')
  })

  test('ignores values that are not valid tonnages yet', () => {
    expect(sumTonnes(['12', '', 'abc', '1.2345'])).toBe('12.000')
  })

  test('has no total when no value is a valid tonnage', () => {
    expect(sumTonnes([])).toBeNull()
    expect(sumTonnes(['', '-1'])).toBeNull()
  })
})

describe('plannedCoverage', () => {
  test('spans from the earliest valid start to the latest valid end', () => {
    const coverage = plannedCoverage([
      { plannedStartAt: '2026-10-01T14:00', plannedEndAt: '2026-10-01T22:00' },
      { plannedStartAt: '2026-10-01T06:00', plannedEndAt: '2026-10-01T14:00' },
      { plannedStartAt: '', plannedEndAt: '2026-10-03T00:00' },
    ])

    expect(coverage).toEqual({
      start: new Date(2026, 9, 1, 6, 0).toISOString(),
      end: new Date(2026, 9, 1, 22, 0).toISOString(),
    })
  })

  test('has no coverage until one shift has a valid period', () => {
    expect(plannedCoverage([])).toBeNull()
    expect(plannedCoverage([{ plannedStartAt: '2026-10-01T06:00', plannedEndAt: '' }])).toBeNull()
  })
})

describe('product lots by customer', () => {
  const cargill = { id: 'customer-cargill', name: 'Cargill France', status: 'AVAILABLE' as const }
  const soufflet = { id: 'customer-soufflet', name: 'Soufflet', status: 'AVAILABLE' as const }

  test('keeps the listed order and sums each customer exactly', () => {
    const groups = groupLotsByCustomer([
      buildLot({ id: 'a', customer: cargill, expectedQuantityTonnes: '0.100' }),
      buildLot({
        id: 'b',
        customer: cargill,
        productName: 'Orge',
        expectedQuantityTonnes: '0.200',
      }),
      buildLot({ id: 'c', customer: soufflet, expectedQuantityTonnes: '800.000' }),
    ])

    expect(
      groups.map((group) => [group.customer.name, group.lots.map((lot) => lot.id), group.subtotal]),
    ).toEqual([
      ['Cargill France', ['a', 'b'], '0.300'],
      ['Soufflet', ['c'], '800.000'],
    ])
  })

  test('says why a lot cannot be removed: the last lot first, then any door it ever had', () => {
    const withEndedDoor = buildLot({
      doorAssignments: [buildDoorPeriod({ effectiveTo: '2026-09-09T05:00:00.000Z' })],
    })

    expect(lotRemovalBlock(buildLot(), 2)).toBeNull()
    expect(lotRemovalBlock(buildLot(), 1)).toBe('E_DISCHARGE_LAST_PRODUCT_LOT')
    expect(lotRemovalBlock(withEndedDoor, 1)).toBe('E_DISCHARGE_LAST_PRODUCT_LOT')
    expect(lotRemovalBlock(withEndedDoor, 2)).toBe('E_PRODUCT_LOT_HAS_DOOR_ASSIGNMENTS')
  })
})
