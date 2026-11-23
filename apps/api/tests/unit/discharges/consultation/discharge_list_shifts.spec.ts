import { test } from '@japa/runner'
import { DateTime } from 'luxon'

import { type ListedShift, pickListShifts } from '#discharges/list/discharge_list_shifts'
import type { ShiftStatus } from '#models/shift'

function shift(sequence: number, status: ShiftStatus): ListedShift {
  const plannedStartAt = DateTime.utc(2026, 9, 12, 4).plus({ hours: 12 * (sequence - 1) })

  return {
    id: `shift-${sequence}`,
    sequence,
    status,
    plannedStartAt,
    plannedEndAt: plannedStartAt.plus({ hours: 12 }),
    responsible: { id: `user-${sequence}`, firstName: 'Sophie', lastName: `Dubois ${sequence}` },
  }
}

test.group('Discharge list shifts', () => {
  test('picks the shift in progress and the first one still planned', ({ assert }) => {
    const shifts = [
      shift(3, 'PLANNED'),
      shift(1, 'COMPLETED'),
      shift(4, 'PLANNED'),
      shift(2, 'ACTIVE'),
    ]

    const { activeShift, nextShift } = pickListShifts(shifts)

    assert.equal(activeShift?.id, 'shift-2')
    assert.equal(nextShift?.id, 'shift-3')
  })

  test('has no active shift between two shifts, and still names the next one', ({ assert }) => {
    const { activeShift, nextShift } = pickListShifts([shift(2, 'PLANNED'), shift(1, 'COMPLETED')])

    assert.isNull(activeShift)
    assert.equal(nextShift?.id, 'shift-2')
  })

  test('has neither once every shift is completed', ({ assert }) => {
    const { activeShift, nextShift } = pickListShifts([
      shift(1, 'COMPLETED'),
      shift(2, 'COMPLETED'),
    ])

    assert.isNull(activeShift)
    assert.isNull(nextShift)
  })

  test('summarises a shift with its position, period, and responsible', ({ assert }) => {
    const { activeShift } = pickListShifts([shift(2, 'ACTIVE')])

    assert.deepEqual(activeShift, {
      id: 'shift-2',
      sequence: 2,
      plannedStartAt: DateTime.utc(2026, 9, 12, 16),
      plannedEndAt: DateTime.utc(2026, 9, 13, 4),
      responsible: { id: 'user-2', firstName: 'Sophie', lastName: 'Dubois 2' },
    })
  })
})
