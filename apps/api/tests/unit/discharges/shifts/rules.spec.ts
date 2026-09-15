import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  findShiftPeriodIssues,
  planShiftSequences,
  planShiftWarehouseDoorSelection,
  planShiftWeighingAreaSelection,
} from '#discharges/shared/planned_shift_rules'

const NOW = DateTime.utc(2026, 9, 15, 8)

const AVAILABLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEPT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ARCHIVED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const IN_ARCHIVED_WAREHOUSE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const UNKNOWN = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

const at = (hour: number, day = 20) => DateTime.utc(2026, 9, day, hour)
const period = (start: DateTime, end: DateTime) => ({ plannedStartAt: start, plannedEndAt: end })

test.group('findShiftPeriodIssues', () => {
  test('accepts a period that only touches the shifts around it', ({ assert }) => {
    const others = [period(at(0), at(6)), period(at(14), at(22))]

    assert.deepEqual(findShiftPeriodIssues(period(at(6), at(14)), others), [])
  })

  test('refuses an end that is not after the start, at the end field', ({ assert }) => {
    for (const end of [at(6), at(5)]) {
      assert.deepEqual(findShiftPeriodIssues(period(at(6), end), []), [
        {
          field: 'plannedEndAt',
          rule: 'shiftPeriodOrder',
          message: 'The planned end must be after the planned start',
        },
      ])
    }
  })

  test('refuses a period overlapping another shift, at the start field', ({ assert }) => {
    assert.deepEqual(findShiftPeriodIssues(period(at(5), at(14)), [period(at(0), at(6))]), [
      {
        field: 'plannedStartAt',
        rule: 'shiftOverlap',
        message: 'This shift overlaps another shift',
      },
    ])
  })
})

test.group('planShiftSequences', () => {
  const shifts = [
    { id: 'first', sequence: 1, ...period(at(6), at(14)) },
    { id: 'second', sequence: 2, ...period(at(14), at(22)) },
    { id: 'third', sequence: 3, ...period(at(6, 21), at(14, 21)) },
  ]

  test('changes nothing while the corrected shift keeps its place', ({ assert }) => {
    assert.deepEqual(planShiftSequences(shifts, { id: 'second', ...period(at(15), at(23)) }), [])
  })

  test('renumbers only the shifts whose place changes', ({ assert }) => {
    assert.deepEqual(planShiftSequences(shifts, { id: 'first', ...period(at(22), at(23, 20)) }), [
      { shiftId: 'second', sequence: 1 },
      { shiftId: 'first', sequence: 2 },
    ])
    assert.deepEqual(planShiftSequences(shifts, { id: 'third', ...period(at(0), at(6)) }), [
      { shiftId: 'third', sequence: 1 },
      { shiftId: 'first', sequence: 2 },
      { shiftId: 'second', sequence: 3 },
    ])
  })

  test('reads the shifts in their sequence order, whatever order they come in', ({ assert }) => {
    assert.deepEqual(
      planShiftSequences([...shifts].reverse(), { id: 'second', ...period(at(15), at(23)) }),
      [],
    )
  })
})

// biome-ignore lint/security/noSecrets: a function name, not a secret
test.group('planShiftWarehouseDoorSelection', () => {
  const doors = new Map([
    [AVAILABLE, { status: 'AVAILABLE' as const, warehouseStatus: 'AVAILABLE' as const }],
    [ARCHIVED, { status: 'ARCHIVED' as const, warehouseStatus: 'AVAILABLE' as const }],
    [IN_ARCHIVED_WAREHOUSE, { status: 'AVAILABLE' as const, warehouseStatus: 'ARCHIVED' as const }],
  ])

  test('refuses an unknown or archived door, or one of an archived warehouse, at its position', ({
    assert,
  }) => {
    const plan = planShiftWarehouseDoorSelection(
      [AVAILABLE, UNKNOWN, ARCHIVED, IN_ARCHIVED_WAREHOUSE],
      [],
      doors,
      NOW,
    )

    assert.deepEqual(plan, {
      kind: 'ISSUES',
      issues: [1, 2, 3].map((index) => ({
        field: `warehouseDoorIds.${index}`,
        rule: 'availableWarehouseDoor',
        message: 'This warehouse door is no longer available',
      })),
    })
  })

  test('keeps a selected door even once archived, deletes removed ones, adds new ones from now', ({
    assert,
  }) => {
    const plan = planShiftWarehouseDoorSelection(
      [KEPT.toUpperCase(), AVAILABLE],
      [
        { id: 'row-kept', resourceId: KEPT },
        { id: 'row-removed', resourceId: ARCHIVED },
      ],
      doors,
      NOW,
    )

    assert.deepEqual(plan, {
      kind: 'PLAN',
      deleteIds: ['row-removed'],
      inserts: [{ resourceId: AVAILABLE, effectiveFrom: NOW }],
    })
  })
})

test.group('planShiftWeighingAreaSelection', () => {
  const areas = new Map([
    [AVAILABLE, { status: 'AVAILABLE' as const }],
    [ARCHIVED, { status: 'ARCHIVED' as const }],
  ])

  test('refuses an unknown or archived area that is not selected yet', ({ assert }) => {
    const plan = planShiftWeighingAreaSelection([UNKNOWN, AVAILABLE, ARCHIVED], [], areas, NOW)

    assert.deepEqual(plan, {
      kind: 'ISSUES',
      issues: [0, 2].map((index) => ({
        field: `weighingAreaIds.${index}`,
        rule: 'availableWeighingArea',
        message: 'This weighing area is no longer available',
      })),
    })
  })

  test('keeps an archived area already selected, and an empty selection clears the rest', ({
    assert,
  }) => {
    const current = [
      { id: 'row-archived', resourceId: ARCHIVED },
      { id: 'row-available', resourceId: AVAILABLE },
    ]

    assert.deepEqual(planShiftWeighingAreaSelection([ARCHIVED], current, new Map(), NOW), {
      kind: 'PLAN',
      deleteIds: ['row-available'],
      inserts: [],
    })
    assert.deepEqual(planShiftWeighingAreaSelection([], current, new Map(), NOW), {
      kind: 'PLAN',
      deleteIds: ['row-archived', 'row-available'],
      inserts: [],
    })
  })
})
