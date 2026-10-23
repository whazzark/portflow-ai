import { describe, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  buildTruckCandidate,
  listedDischarge,
} from '@/features/discharges/__tests__/support/fixtures'
import {
  candidateGroups,
  candidateMatchesSearch,
  heldPoolEntries,
  offeredShiftTrucks,
  poolSummary,
  shiftCountByTruck,
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

const PLANNED_HOLDING = {
  dischargeId: 'discharge-loire',
  vesselName: 'MV Loire Star',
  status: 'PLANNED' as const,
}
const ACTIVE_HOLDING = {
  dischargeId: 'discharge-cedar',
  vesselName: 'MV Ocean Cedar',
  status: 'ACTIVE' as const,
}

describe('poolSummary', () => {
  test('counts the trucks still held and the suspended ones among them', () => {
    const detail = buildDischargeDetail(planned, {
      truckPool: [
        HELD,
        SUSPENDED,
        { ...RELEASED, truckStatus: 'SUSPENDED', otherHoldings: [PLANNED_HOLDING] },
      ],
    })

    expect(poolSummary(detail)).toEqual({
      heldCount: 2,
      suspendedCount: 1,
      contested: false,
      contestedByActive: false,
    })
  })

  test('says whether another discharge holds a held truck, and whether it is active', () => {
    const plannedOnly = buildDischargeDetail(planned, {
      truckPool: [{ ...HELD, otherHoldings: [PLANNED_HOLDING] }, SUSPENDED],
    })
    const withActive = buildDischargeDetail(planned, {
      truckPool: [{ ...HELD, otherHoldings: [PLANNED_HOLDING, ACTIVE_HOLDING] }],
    })

    expect(poolSummary(plannedOnly)).toMatchObject({ contested: true, contestedByActive: false })
    expect(poolSummary(withActive)).toMatchObject({ contested: true, contestedByActive: true })
  })

  test('holds nothing on a closed discharge', () => {
    const detail = buildDischargeDetail(planned, {
      status: 'CLOSED',
      truckPool: [{ ...HELD, otherHoldings: [PLANNED_HOLDING] }],
    })

    expect(poolSummary(detail)).toEqual({
      heldCount: 0,
      suspendedCount: 0,
      contested: false,
      contestedByActive: false,
    })
  })
})

// biome-ignore lint/security/noSecrets: a function name, not a secret
describe('shiftCountByTruck', () => {
  test('counts the planned shifts each truck is currently selected in', () => {
    const detail = buildDischargeDetail(planned, {
      truckPool: [HELD, SUSPENDED],
      shifts: [
        buildShift({ id: 'one', trucks: [current('truck-held'), current('truck-suspended')] }),
        buildShift({ id: 'two', trucks: [current('truck-held')] }),
        buildShift({
          id: 'ended',
          trucks: [{ ...current('truck-suspended'), effectiveTo: '2026-09-08T08:00:00.000Z' }],
        }),
        buildShift({ id: 'started', status: 'ACTIVE', trucks: [current('truck-held')] }),
      ],
    })

    const counts = shiftCountByTruck(detail)

    expect(counts.get('truck-held')).toBe(2)
    expect(counts.get('truck-suspended')).toBe(1)
    expect(counts.get('truck-unknown') ?? 0).toBe(0)
  })
})

describe('candidateGroups', () => {
  test('groups candidates by transport company, by name, with their selected count', () => {
    const port = { id: 'company-port', name: 'Transports du Port' }
    const armor = { id: 'company-armor', name: 'Armor Fret' }
    const candidates = [
      buildTruckCandidate({ id: 'c', registration: 'ZZ-900-ZZ', transportCompany: port }),
      buildTruckCandidate({ id: 'a', registration: 'BB-200-BB', transportCompany: armor }),
      buildTruckCandidate({ id: 'b', registration: 'AA-100-AA', transportCompany: port }),
      buildTruckCandidate({ id: 'd', registration: 'AA-100-AB', transportCompany: armor }),
    ]

    const groups = candidateGroups(candidates, new Set(['a', 'c']))

    expect(
      groups.map((group) => ({
        company: group.company.name,
        registrations: group.candidates.map((candidate) => candidate.registration),
        total: group.total,
        selected: group.selected,
      })),
    ).toEqual([
      { company: 'Armor Fret', registrations: ['AA-100-AB', 'BB-200-BB'], total: 2, selected: 1 },
      {
        company: 'Transports du Port',
        registrations: ['AA-100-AA', 'ZZ-900-ZZ'],
        total: 2,
        selected: 1,
      },
    ])
  })
})
