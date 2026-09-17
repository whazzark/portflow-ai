import { describe, expect, test } from 'vitest'

import { buildShift } from '@/features/discharges/__tests__/support/fixtures'
import {
  blockRowCount,
  defaultShiftId,
  drawnPeriod,
  openShift,
  shiftCalendar,
} from '@/features/discharges/shift-calendar'

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

  test('opens on the day the discharge is expected to start, a column per day from midnight', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6, 30),
      shifts: [shift('day', at(4, 7), at(4, 13)), shift('next-day', at(5, 7), at(5, 13))],
    })

    // A week at least, with only the discharge's own days numbered.
    expect(calendar?.columns).toEqual([
      { index: 0, label: 'Day 1', startLabel: 'Sun 4 Oct' },
      { index: 1, label: 'Day 2', startLabel: 'Mon 5 Oct' },
      { index: 2, label: null, startLabel: 'Tue 6 Oct' },
      { index: 3, label: null, startLabel: 'Wed 7 Oct' },
      { index: 4, label: null, startLabel: 'Thu 8 Oct' },
      { index: 5, label: null, startLabel: 'Fri 9 Oct' },
      { index: 6, label: null, startLabel: 'Sat 10 Oct' },
    ])
    expect(calendar?.hourMarks.map((mark) => mark.label)).toEqual([
      '00:00',
      '02:00',
      '04:00',
      '06:00',
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
      '20:00',
      '22:00',
    ])
    expect(calendar?.expectedStart).toMatchObject({ column: 0 })
    expect(calendar?.expectedStart?.pct).toBeCloseTo(27.0833)
  })

  test('shows every day of a discharge longer than a week', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [shift('first', at(4, 6), at(4, 14)), shift('last', at(12, 6), at(12, 14))],
    })

    expect(calendar?.columns).toHaveLength(9)
    expect(calendar?.columns.at(-1)).toEqual({ index: 8, label: 'Day 9', startLabel: 'Mon 12 Oct' })
  })

  test('does not count the next day for a shift ending at midnight', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 16),
      shifts: [shift('evening', at(4, 16), at(5, 0))],
    })

    expect(calendar?.columns.map((column) => column.label)).toEqual([
      'Day 1',
      null,
      null,
      null,
      null,
      null,
      null,
    ])
    expect(pieces(calendar)).toEqual([
      { id: 'evening', column: 0, top: 66.67, height: 33.33, primary: true },
    ])
  })

  test('draws no expected start line when the calendar already opens on it', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 0),
      shifts: [shift('day', at(4, 6), at(4, 14))],
    })

    expect(calendar?.expectedStart).toBeNull()
  })

  test('reaches back to a shift planned before the expected day, and marks that start', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(5, 8),
      shifts: [shift('early', at(4, 5, 30), at(4, 12))],
    })

    expect(calendar?.columns[0]).toEqual({ index: 0, label: 'Day 1', startLabel: 'Sun 4 Oct' })
    expect(calendar?.columns[1]?.label).toBe('Day 2')
    expect(calendar?.expectedStart).toMatchObject({ column: 1 })
    expect(calendar?.expectedStart?.pct).toBeCloseTo(33.3333)
  })

  test('cuts a shift worked past midnight, with only its first piece standing for it', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [shift('day', at(4, 6), at(4, 14)), shift('night', at(4, 22), at(5, 6))],
    })

    expect(pieces(calendar)).toEqual([
      { id: 'day', column: 0, top: 25, height: 33.33, primary: true },
      { id: 'night', column: 0, top: 91.67, height: 8.33, primary: true },
      { id: 'night', column: 1, top: 0, height: 25, primary: false },
    ])
    expect(
      calendar?.segments.map((segment) => [segment.continuesFromPrevious, segment.continuesToNext]),
    ).toEqual([
      [false, false],
      [false, true],
      [true, false],
    ])
  })

  test('keeps each column on midnight across a change of clocks', () => {
    // Clocks go back in much of Europe during the night of 25 October 2026.
    const calendar = shiftCalendar({
      expectedStartAt: at(24, 6),
      shifts: [
        shift('day', at(25, 6), at(25, 14)),
        shift('night', at(25, 22), at(26, 0)),
        shift('morning', at(26, 0), at(26, 8)),
      ],
    })

    expect(calendar?.columns.slice(0, 3).map((column) => column.startLabel)).toEqual([
      'Sat 24 Oct',
      'Sun 25 Oct',
      'Mon 26 Oct',
    ])
    // Placed by the clock, so a shift of that day lines up with the hours beside it.
    expect(pieces(calendar)).toEqual([
      { id: 'day', column: 1, top: 25, height: 33.33, primary: true },
      { id: 'night', column: 1, top: 91.67, height: 8.33, primary: true },
      { id: 'morning', column: 2, top: 0, height: 33.33, primary: true },
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
      [0, '50.00', '25.00'],
      [1, '8.33', '25.00'],
    ])
  })

  test('reads each break’s duration once, in its tallest piece, before the shift it precedes', () => {
    const calendar = shiftCalendar({
      expectedStartAt: at(4, 6),
      shifts: [
        shift('day', at(4, 6), at(4, 14)),
        shift('evening', at(4, 14, 30), at(4, 22)),
        shift('morning', at(5, 6), at(5, 14)),
      ],
    })

    expect(
      calendar?.breaks.map((gap) => [gap.shiftId, gap.column, gap.duration, gap.labelled]),
    ).toEqual([
      ['evening', 0, '30 min', true],
      ['morning', 0, '8 h', false],
      ['morning', 1, '8 h', true],
    ])
  })

  test('shows the current time only while it falls within the calendar', () => {
    const discharge = { expectedStartAt: at(4, 6), shifts: [shift('day', at(4, 6), at(5, 12))] }

    expect(shiftCalendar(discharge, new Date(at(5, 12)))?.now).toEqual({ column: 1, pct: 50 })
    // The days filling out the week are part of the calendar too.
    expect(shiftCalendar(discharge, new Date(at(6, 6)))?.now).toEqual({ column: 2, pct: 25 })
    expect(shiftCalendar(discharge, new Date(at(3, 23)))?.now).toBeNull()
    expect(shiftCalendar(discharge, new Date(at(11, 0)))?.now).toBeNull()
    expect(shiftCalendar(discharge)?.now).toBeNull()
  })
})

describe('drawing a period', () => {
  const hourPct = (hours: number) => (hours / 24) * 100
  const calendar = shiftCalendar({
    expectedStartAt: null,
    shifts: [shift('day', at(4, 7), at(4, 13))],
  })

  test('reads a point down a column as its clock, snapped to half an hour', () => {
    expect(calendar?.instantAt(1, hourPct(14.2))).toBe(Date.parse(at(5, 14)))
    expect(calendar?.instantAt(0, hourPct(14.3))).toBe(Date.parse(at(4, 14, 30)))
  })

  test('keeps a point dragged past the columns within them', () => {
    expect(calendar?.instantAt(-1, hourPct(12))).toBe(Date.parse(at(4, 12)))
    expect(calendar?.instantAt(0, 120)).toBe(Date.parse(at(5, 0)))
    expect(calendar?.instantAt(99, hourPct(6))).toBe(Date.parse(at(10, 6)))
  })

  test('reads the clock on a day the clocks change', () => {
    const changing = shiftCalendar({
      expectedStartAt: null,
      shifts: [shift('day', at(25, 7), at(25, 13))],
    })

    expect(changing?.instantAt(0, hourPct(14))).toBe(Date.parse(at(25, 14)))
  })

  test('orders the ends of a period drawn upwards, and across midnight', () => {
    expect(drawnPeriod(Date.parse(at(4, 22)), Date.parse(at(4, 14)), null)).toEqual({
      plannedStartAt: at(4, 14),
      plannedEndAt: at(4, 22),
    })
    expect(drawnPeriod(Date.parse(at(4, 22)), Date.parse(at(5, 6)), null)).toEqual({
      plannedStartAt: at(4, 22),
      plannedEndAt: at(5, 6),
    })
  })

  test('gives a press the last shift’s duration, or only a start without one', () => {
    const eightHours = 8 * 3_600_000

    expect(drawnPeriod(Date.parse(at(4, 14)), Date.parse(at(4, 14)), eightHours)).toEqual({
      plannedStartAt: at(4, 14),
      plannedEndAt: at(4, 22),
    })
    expect(drawnPeriod(Date.parse(at(4, 14)), Date.parse(at(4, 14)), null)).toEqual({
      plannedStartAt: at(4, 14),
      plannedEndAt: null,
    })
  })
})

describe('the shift in view', () => {
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

  test('opens the shift an address names, and none when it names none of them', () => {
    expect(openShift([completed, active, planned], 'planned')?.id).toBe('planned')
    expect(openShift([completed, active, planned], 'gone')).toBeUndefined()
    expect(openShift([completed, active, planned], undefined)).toBeUndefined()
  })
})

describe('blockRowCount', () => {
  const HOUR_PX = 32

  test('keeps the times, then adds a line per hour as height allows, up to all four', () => {
    expect(blockRowCount(HOUR_PX)).toBe(1)
    expect(blockRowCount(2 * HOUR_PX)).toBe(2)
    expect(blockRowCount(3 * HOUR_PX)).toBe(3)
    expect(blockRowCount(4 * HOUR_PX)).toBe(4)
    expect(blockRowCount(8 * HOUR_PX)).toBe(4)
  })

  test('keeps the times even on a card too short for them', () => {
    expect(blockRowCount(10)).toBe(1)
  })
})
