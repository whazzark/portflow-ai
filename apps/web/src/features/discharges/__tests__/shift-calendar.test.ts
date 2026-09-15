import { describe, expect, test } from 'vitest'

import { buildShift } from '@/features/discharges/__tests__/support/fixtures'
import { defaultShiftId, openShift, shiftCalendar } from '@/features/discharges/shift-calendar'

// Local times, so the calendar reads the same whatever zone the suite runs in.
const at = (day: number, hours: number, minutes = 0) =>
  new Date(2026, 9, day, hours, minutes).toISOString()

const shift = (
  id: string,
  start: string,
  end: string,
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' = 'PLANNED',
) => buildShift({ id, plannedStartAt: start, plannedEndAt: end, status })

const pieces = (calendar: ReturnType<typeof shiftCalendar>) =>
  calendar?.segments.map((segment) => ({
    id: segment.shift.id,
    column: segment.column,
    top: Number(segment.topPct.toFixed(2)),
    height: Number(segment.heightPct.toFixed(2)),
    primary: segment.primary,
  }))

describe('shiftCalendar', () => {
  test('places nothing without a shift', () => {
    expect(shiftCalendar({ expectedStartAt: at(4, 6), shifts: [] })).toBeNull()
  })

  test('opens each 24-hour column at the hour the discharge is expected to start', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6, 30),
      shifts: [shift('day', at(4, 7), at(4, 13)), shift('next-day', at(5, 7), at(5, 13))],
    })

    expect(calendar?.columns).toEqual([
      { index: 0, label: 'Day 1', startLabel: 'Sun 4 Oct 06:00' },
      { index: 1, label: 'Day 2', startLabel: 'Mon 5 Oct 06:00' },
    ])
    expect(calendar?.hourMarks.map((mark) => mark.label)).toEqual([
      '06:00',
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
      '20:00',
      '22:00',
      '00:00',
      '02:00',
      '04:00',
    ])
    // The half hour past the column's opening is worth a line of its own.
    expect(calendar?.expectedStart).toMatchObject({ column: 0 })
    expect(calendar?.expectedStart?.pct).toBeCloseTo(2.0833)
  })

  test('draws no expected start line when the calendar already opens on it', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [shift('day', at(4, 6), at(4, 14))],
    })

    expect(calendar?.expectedStart).toBeNull()
  })

  test('reaches back to a shift planned before the expected start, and marks that start', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 8),
      shifts: [shift('early', at(4, 5, 30), at(4, 12))],
    })

    expect(calendar?.columns[0]?.startLabel).toBe('Sun 4 Oct 05:00')
    expect(calendar?.expectedStart).toMatchObject({ column: 0 })
    expect(calendar?.expectedStart?.pct).toBeCloseTo(12.5)
  })

  test('keeps a night shift as one block within the column it starts in', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [shift('day', at(4, 6), at(4, 14)), shift('night', at(4, 22), at(5, 6))],
    })

    expect(calendar?.columns).toHaveLength(1)
    expect(pieces(calendar)).toEqual([
      { id: 'day', column: 0, top: 0, height: 33.33, primary: true },
      { id: 'night', column: 0, top: 66.67, height: 33.33, primary: true },
    ])
  })

  test('cuts a shift crossing a column edge, with only its first piece standing for it', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [shift('dawn', at(5, 4), at(5, 8))],
    })

    expect(calendar?.columns).toHaveLength(2)
    expect(pieces(calendar)).toEqual([
      { id: 'dawn', column: 0, top: 91.67, height: 8.33, primary: true },
      { id: 'dawn', column: 1, top: 0, height: 8.33, primary: false },
    ])
    expect(
      calendar?.segments.map((segment) => [segment.continuesFromPrevious, segment.continuesToNext]),
    ).toEqual([
      [false, true],
      [true, false],
    ])
  })

  test('marks the breaks between shifts in their columns, and none where shifts touch or overlap', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [
        shift('first', at(4, 6), at(4, 10)),
        shift('second', at(4, 10), at(4, 12)),
        shift('overlapping', at(4, 11), at(4, 12)),
        shift('evening', at(4, 18), at(5, 2)),
        shift('next-day', at(5, 8), at(5, 12)),
      ],
    })

    expect(
      calendar?.breaks.map((gap) => [gap.column, gap.topPct.toFixed(2), gap.heightPct.toFixed(2)]),
    ).toEqual([
      [0, '25.00', '25.00'],
      [0, '83.33', '16.67'],
      [1, '0.00', '8.33'],
    ])
  })

  test('shows the current time only while it falls within the calendar', () => {
    const discharge = { expectedStartAt: at(4, 6), shifts: [shift('day', at(4, 6), at(5, 12))] }

    expect(shiftCalendar(discharge, new Date(at(5, 12)))?.now).toEqual({ column: 1, pct: 25 })
    expect(shiftCalendar(discharge, new Date(at(6, 6)))?.now).toBeNull()
    expect(shiftCalendar(discharge)?.now).toBeNull()
  })
})

describe('the open shift', () => {
  const completed = shift('completed', at(4, 6), at(4, 14), 'COMPLETED')
  const active = shift('active', at(4, 15), at(4, 22), 'ACTIVE')
  const planned = shift('planned', at(5, 6), at(5, 14))

  test('defaults to the shift under way, else the next to prepare, else the last one', () => {
    expect(defaultShiftId([completed, active, planned])).toBe('active')
    expect(defaultShiftId([completed, planned])).toBe('planned')
    expect(defaultShiftId([completed, { ...completed, id: 'completed-later' }])).toBe(
      'completed-later',
    )
    expect(defaultShiftId([])).toBeNull()
  })

  test('opens the shift an address names, or the default when it names none of them', () => {
    expect(openShift([completed, active, planned], 'planned')?.id).toBe('planned')
    expect(openShift([completed, active, planned], 'gone')?.id).toBe('active')
    expect(openShift([completed, active, planned], undefined)?.id).toBe('active')
  })
})
