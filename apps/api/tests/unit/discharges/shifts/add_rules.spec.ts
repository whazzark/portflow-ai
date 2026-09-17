import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import {
  findAddedShiftIssues,
  planAddedShiftSequences,
  startedShiftStart,
} from '#discharges/shared/planned_shift_rules'
import type { ShiftStatus } from '#models/shift'

const at = (hour: number, day = 20) => DateTime.utc(2026, 9, day, hour)
const period = (start: DateTime, end: DateTime) => ({ plannedStartAt: start, plannedEndAt: end })
const shift = (
  id: string,
  sequence: number,
  start: DateTime,
  end: DateTime,
  status: ShiftStatus = 'PLANNED',
) => ({ id, sequence, status, ...period(start, end) })

const OVERLAP = {
  field: 'plannedStartAt',
  rule: 'shiftOverlap',
  message: 'This shift overlaps another shift',
}
const AFTER_STARTED = {
  field: 'plannedStartAt',
  rule: 'shiftAfterStartedShifts',
  message: 'A new shift must start after the shifts already started',
}

test.group('findAddedShiftIssues', () => {
  test('accepts a period that only touches the shifts around it', ({ assert }) => {
    const shifts = [shift('a', 1, at(0), at(6)), shift('b', 2, at(14), at(22))]

    assert.deepEqual(findAddedShiftIssues(period(at(6), at(14)), shifts), [])
  })

  test('refuses an end that is not after the start, at the end field', ({ assert }) => {
    for (const end of [at(6), at(5)]) {
      assert.deepEqual(findAddedShiftIssues(period(at(6), end), []), [
        {
          field: 'plannedEndAt',
          rule: 'shiftPeriodOrder',
          message: 'The planned end must be after the planned start',
        },
      ])
    }
  })

  test('refuses a period overlapping a shift of any status, at the start field', ({ assert }) => {
    for (const status of ['PLANNED', 'ACTIVE', 'COMPLETED'] as const) {
      assert.deepEqual(
        // Starts after the shift does, so only its overlap with the shift's end refuses it.
        findAddedShiftIssues(period(at(10), at(16)), [shift('a', 1, at(6), at(14), status)]),
        [OVERLAP],
      )
    }
  })

  test('refuses a start not after the latest started shift start', ({ assert }) => {
    const shifts = [
      shift('done', 1, at(22, 18), at(6, 19), 'COMPLETED'),
      shift('running', 2, at(6, 19), at(14, 19), 'ACTIVE'),
      shift('next', 3, at(14, 19), at(22, 19)),
    ]

    // Before the active shift, clear of every period: only the started rule refuses it.
    assert.deepEqual(findAddedShiftIssues(period(at(0, 18), at(6, 18)), shifts), [AFTER_STARTED])
    // Starting with the active shift overlaps it too.
    assert.deepEqual(findAddedShiftIssues(period(at(6, 19), at(7, 19)), shifts), [
      OVERLAP,
      AFTER_STARTED,
    ])
  })

  test('accepts a start after the started shifts, even between planned ones', ({ assert }) => {
    const shifts = [
      shift('running', 1, at(6, 19), at(14, 19), 'ACTIVE'),
      shift('first', 2, at(22, 19), at(6, 20)),
      shift('last', 3, at(22, 20), at(6, 21)),
    ]

    assert.deepEqual(findAddedShiftIssues(period(at(6, 20), at(14, 20)), shifts), [])
    assert.deepEqual(findAddedShiftIssues(period(at(14, 19), at(22, 19)), shifts), [])
  })

  test('never applies the started rule when every shift is planned', ({ assert }) => {
    const shifts = [shift('late', 1, at(6, 25), at(14, 25))]

    assert.deepEqual(findAddedShiftIssues(period(at(6, 1), at(14, 1)), shifts), [])
  })
})

test.group('startedShiftStart', () => {
  test('reads the planned start until an actual start is recorded', ({ assert }) => {
    const running = shift('running', 1, at(6), at(14), 'ACTIVE')

    assert.equal(startedShiftStart(running).toMillis(), at(6).toMillis())
  })
})

test.group('planAddedShiftSequences', () => {
  const shifts = [shift('first', 1, at(6), at(14)), shift('second', 2, at(14), at(22))]

  test('numbers a shift added last after the others, renumbering nothing', ({ assert }) => {
    assert.deepEqual(planAddedShiftSequences(shifts, period(at(22), at(6, 21))), {
      sequence: 3,
      sequences: [],
    })
  })

  test('renumbers only the shifts planned after one added first or between', ({ assert }) => {
    assert.deepEqual(planAddedShiftSequences(shifts, period(at(0), at(6))), {
      sequence: 1,
      sequences: [
        { shiftId: 'first', sequence: 2 },
        { shiftId: 'second', sequence: 3 },
      ],
    })
    assert.deepEqual(
      planAddedShiftSequences(
        [shift('first', 1, at(0), at(6)), shift('last', 2, at(14), at(22))],
        period(at(6), at(14)),
      ),
      { sequence: 2, sequences: [{ shiftId: 'last', sequence: 3 }] },
    )
  })

  test('refuses to renumber a started shift', ({ assert }) => {
    const started = [shift('running', 1, at(6), at(14), 'ACTIVE')]

    assert.throws(() => planAddedShiftSequences(started, period(at(0), at(6))))
  })
})
