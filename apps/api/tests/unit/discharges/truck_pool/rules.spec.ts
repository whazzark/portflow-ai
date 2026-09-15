import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import type { LockedTruck } from '#discharges/shared/repositories/discharge_preparation_repository'
import {
  planReservation,
  planShiftSelection,
  planWithdrawal,
} from '#discharges/shared/truck_pool_rules'

const NOW = DateTime.utc(2026, 9, 15, 8)
const RESERVED_AT = DateTime.utc(2026, 9, 1, 6)

const AVAILABLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const HELD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RELEASED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ARCHIVED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const SUSPENDED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const UNKNOWN = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

function truck(id: string, status: LockedTruck['status'] = 'AVAILABLE'): [string, LockedTruck] {
  return [
    id,
    {
      id,
      status,
      registration: `REG-${id.slice(0, 4)}`,
      transportCompanyId: 'company-1',
      transportCompanyName: 'Transports du Port',
    },
  ]
}

const TRUCKS = new Map([
  truck(AVAILABLE),
  truck(HELD),
  truck(RELEASED),
  truck(ARCHIVED, 'ARCHIVED'),
  truck(SUSPENDED, 'SUSPENDED'),
])

const POOL = [
  { id: 'row-held', truckId: HELD, releasedAt: null },
  { id: 'row-released', truckId: RELEASED, releasedAt: RESERVED_AT },
]

test.group('planReservation', () => {
  test('refuses unknown, archived, and suspended trucks at their request positions', ({
    assert,
  }) => {
    const plan = planReservation([AVAILABLE, ARCHIVED, UNKNOWN, SUSPENDED], POOL, TRUCKS, NOW)

    assert.deepEqual(plan, {
      kind: 'ISSUES',
      issues: [
        {
          field: 'truckIds.1',
          rule: 'availableTruck',
          message: 'This truck is no longer available to reserve',
        },
        {
          field: 'truckIds.2',
          rule: 'availableTruck',
          message: 'This truck is no longer available to reserve',
        },
        {
          field: 'truckIds.3',
          rule: 'availableTruck',
          message: 'This truck is no longer available to reserve',
        },
      ],
    })
  })

  test('inserts a new truck with the values captured now, and reactivates a released row', ({
    assert,
  }) => {
    const plan = planReservation([AVAILABLE, RELEASED], POOL, TRUCKS, NOW)

    assert.deepEqual(plan, {
      kind: 'PLAN',
      inserts: [
        {
          truckId: AVAILABLE,
          registrationSnapshot: 'REG-aaaa',
          transportCompanyId: 'company-1',
          transportCompanyNameSnapshot: 'Transports du Port',
          reservedAt: NOW,
        },
      ],
      reactivations: [
        {
          assignmentId: 'row-released',
          truckId: RELEASED,
          registrationSnapshot: 'REG-cccc',
          transportCompanyId: 'company-1',
          transportCompanyNameSnapshot: 'Transports du Port',
          reservedAt: NOW,
        },
      ],
    })
  })

  test('leaves a truck the discharge already holds unchanged, so a replay plans nothing', ({
    assert,
  }) => {
    assert.deepEqual(planReservation([HELD], POOL, TRUCKS, NOW), {
      kind: 'PLAN',
      inserts: [],
      reactivations: [],
    })
  })

  test('matches identities whatever their casing', ({ assert }) => {
    const plan = planReservation([HELD.toUpperCase()], POOL, TRUCKS, NOW)

    assert.deepEqual(plan, { kind: 'PLAN', inserts: [], reactivations: [] })
  })
})

test.group('planShiftSelection', () => {
  const HELD_IDS = new Set([AVAILABLE, HELD, SUSPENDED])
  const ADDED_TRUCKS = new Map([truck(AVAILABLE), truck(HELD), truck(SUSPENDED, 'SUSPENDED')])

  test('plans nothing for an unchanged selection', ({ assert }) => {
    const current = [{ id: 'row-held', truckId: HELD }]

    assert.deepEqual(planShiftSelection([HELD], HELD_IDS, current, ADDED_TRUCKS, NOW), {
      kind: 'PLAN',
      deleteIds: [],
      inserts: [],
    })
  })

  test('selects added trucks from now and lets removed ones go', ({ assert }) => {
    const current = [{ id: 'row-held', truckId: HELD }]

    assert.deepEqual(planShiftSelection([AVAILABLE], HELD_IDS, current, ADDED_TRUCKS, NOW), {
      kind: 'PLAN',
      deleteIds: ['row-held'],
      inserts: [{ truckId: AVAILABLE, effectiveFrom: NOW }],
    })
  })

  test('clears the whole selection for an empty request', ({ assert }) => {
    const current = [
      { id: 'row-held', truckId: HELD },
      { id: 'row-suspended', truckId: SUSPENDED },
    ]

    assert.deepEqual(planShiftSelection([], HELD_IDS, current, ADDED_TRUCKS, NOW), {
      kind: 'PLAN',
      deleteIds: ['row-held', 'row-suspended'],
      inserts: [],
    })
  })

  test('refuses a truck the discharge does not hold, before judging its status', ({ assert }) => {
    const trucks = new Map([truck(UNKNOWN, 'SUSPENDED'), truck(AVAILABLE)])

    assert.deepEqual(planShiftSelection([AVAILABLE, UNKNOWN], HELD_IDS, [], trucks, NOW), {
      kind: 'ISSUES',
      issues: [
        {
          field: 'truckIds.1',
          rule: 'heldTruck',
          message: "This truck is no longer in this discharge's pool",
        },
      ],
    })
  })

  test('refuses a suspended truck newly selected, but keeps one already selected', ({ assert }) => {
    assert.deepEqual(planShiftSelection([SUSPENDED], HELD_IDS, [], ADDED_TRUCKS, NOW), {
      kind: 'ISSUES',
      issues: [
        {
          field: 'truckIds.0',
          rule: 'selectableTruck',
          message: 'A suspended truck cannot be newly selected',
        },
      ],
    })

    const current = [{ id: 'row-suspended', truckId: SUSPENDED }]
    assert.deepEqual(planShiftSelection([SUSPENDED], HELD_IDS, current, new Map(), NOW), {
      kind: 'PLAN',
      deleteIds: [],
      inserts: [],
    })
  })
})

test.group('planWithdrawal', () => {
  const SELECTIONS = [
    { id: 'sel-held-1', shiftId: 'shift-1', truckId: HELD },
    { id: 'sel-held-2', shiftId: 'shift-2', truckId: HELD },
    { id: 'sel-available', shiftId: 'shift-1', truckId: AVAILABLE },
  ]
  const WITHDRAWAL_POOL = [...POOL, { id: 'row-available', truckId: AVAILABLE, releasedAt: null }]

  test('withdraws a held truck with its current selections in every planned shift', ({
    assert,
  }) => {
    assert.deepEqual(planWithdrawal([HELD], WITHDRAWAL_POOL, SELECTIONS), {
      assignmentIds: ['row-held'],
      selectionIds: ['sel-held-1', 'sel-held-2'],
    })
  })

  test('ignores a released truck and one the discharge never held', ({ assert }) => {
    assert.deepEqual(planWithdrawal([RELEASED, UNKNOWN], WITHDRAWAL_POOL, SELECTIONS), {
      assignmentIds: [],
      selectionIds: [],
    })
  })

  test('matches identities whatever their casing', ({ assert }) => {
    assert.deepEqual(planWithdrawal([AVAILABLE.toUpperCase()], WITHDRAWAL_POOL, SELECTIONS), {
      assignmentIds: ['row-available'],
      selectionIds: ['sel-available'],
    })
  })
})
