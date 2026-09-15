import { describe, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '@/features/discharges/__tests__/support/fixtures'
import {
  candidateMatchesSearch,
  heldPoolEntries,
  missingTrucks,
  offeredShiftTrucks,
  shiftsSelectingTrucks,
} from '@/features/discharges/truck-pool-selection'
import type { TruckCandidateDto } from '@/features/discharges/types'

const planned = listedDischarge('MV Atlantic Dawn', 'PLANNED')

const HELD = buildPoolEntry({ id: 'pool-held', truckId: 'truck-held', registration: 'AA-100-AA' })
const SUSPENDED = buildPoolEntry({
  id: 'pool-suspended',
  truckId: 'truck-suspended',
  registration: 'BB-200-BB',
  truckStatus: 'SUSPENDED',
})
const RELEASED = buildPoolEntry({
  id: 'pool-released',
  truckId: 'truck-released',
  registration: 'CC-300-CC',
  releasedAt: '2026-09-08T08:00:00.000Z',
})

const current = (truckId: string, id = `row-${truckId}`) => ({
  id,
  truckId,
  registration: truckId,
  truckStatus: 'AVAILABLE' as const,
  effectiveFrom: '2026-09-07T08:00:00.000Z',
  effectiveTo: null,
})

describe('heldPoolEntries', () => {
  test('keeps the entries the discharge still holds, in pool order', () => {
    const detail = buildDischargeDetail(planned, { truckPool: [RELEASED, HELD, SUSPENDED] })

    expect(heldPoolEntries(detail).map((entry) => entry.id)).toEqual([
      'pool-held',
      'pool-suspended',
    ])
  })

  test('holds nothing on a closed discharge', () => {
    const detail = buildDischargeDetail(planned, { status: 'CLOSED', truckPool: [HELD] })

    expect(heldPoolEntries(detail)).toEqual([])
  })
})

describe('shiftsSelectingTrucks', () => {
  test('lists the planned shifts currently selecting one of the trucks, by planned start', () => {
    const later = buildShift({
      id: 'later',
      plannedStartAt: '2026-10-05T06:00:00.000Z',
      trucks: [current('truck-held')],
    })
    const earlier = buildShift({
      id: 'earlier',
      plannedStartAt: '2026-10-04T06:00:00.000Z',
      trucks: [current('truck-suspended')],
    })
    const ended = buildShift({
      id: 'ended',
      trucks: [{ ...current('truck-held'), effectiveTo: '2026-10-04T08:00:00.000Z' }],
    })
    const active = buildShift({ id: 'active', status: 'ACTIVE', trucks: [current('truck-held')] })
    const unrelated = buildShift({ id: 'unrelated', trucks: [current('truck-other')] })
    const detail = buildDischargeDetail(planned, {
      shifts: [later, ended, active, unrelated, earlier],
    })

    expect(
      shiftsSelectingTrucks(detail, ['truck-held', 'truck-suspended']).map((shift) => shift.id),
    ).toEqual(['earlier', 'later'])
  })
})

describe('offeredShiftTrucks', () => {
  test('offers held trucks that are not suspended, and keeps a suspended one already selected', () => {
    const otherSuspended = buildPoolEntry({
      id: 'pool-other-suspended',
      truckId: 'truck-other-suspended',
      registration: 'DD-400-DD',
      truckStatus: 'SUSPENDED',
    })
    const shift = buildShift({ id: 'shift-1', trucks: [current('truck-suspended')] })
    const detail = buildDischargeDetail(planned, {
      truckPool: [HELD, SUSPENDED, RELEASED, otherSuspended],
      shifts: [shift],
    })

    expect(offeredShiftTrucks(detail, 'shift-1')).toEqual([
      {
        truckId: 'truck-held',
        registration: 'AA-100-AA',
        truckStatus: 'AVAILABLE',
        selected: false,
        canCheck: true,
      },
      {
        truckId: 'truck-suspended',
        registration: 'BB-200-BB',
        truckStatus: 'SUSPENDED',
        selected: true,
        canCheck: false,
      },
    ])
  })
})

describe('candidateMatchesSearch', () => {
  const candidate: TruckCandidateDto = {
    id: 'truck-1',
    registration: 'AB-123-CD',
    transportCompany: { id: 'company-1', name: 'Transports Émeraude' },
    otherHoldings: [],
  }

  test('matches the registration or the company name, ignoring case, accents, and spaces', () => {
    expect(candidateMatchesSearch(candidate, '')).toBe(true)
    expect(candidateMatchesSearch(candidate, ' ab-123 ')).toBe(true)
    expect(candidateMatchesSearch(candidate, 'emeraude')).toBe(true)
    expect(candidateMatchesSearch(candidate, 'cargill')).toBe(false)
  })
})

describe('a planned shift without trucks', () => {
  const truck = (truckId: string, effectiveTo: string | null) => ({
    id: `row-${truckId}-${effectiveTo ?? 'open'}`,
    truckId,
    registration: truckId.toUpperCase(),
    truckStatus: 'AVAILABLE' as const,
    effectiveFrom: '2026-10-04T06:00:00.000Z',
    effectiveTo,
  })

  test('flags only a planned shift with no truck in effect', () => {
    const ended = [truck('truck-a', '2026-10-04T09:00:00.000Z')]

    expect(missingTrucks(buildShift({ status: 'PLANNED', trucks: ended }))).toBe(true)
    expect(missingTrucks(buildShift({ status: 'PLANNED', trucks: [truck('truck-a', null)] }))).toBe(
      false,
    )
    expect(missingTrucks(buildShift({ status: 'ACTIVE', trucks: [] }))).toBe(false)
  })
})
