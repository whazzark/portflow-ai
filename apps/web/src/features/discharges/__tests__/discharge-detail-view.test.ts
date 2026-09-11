import { describe, expect, test } from 'vitest'

import {
  formatPeriod,
  formatTonnes,
  isInEffect,
  lotDoorNotice,
  splitPeriods,
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
