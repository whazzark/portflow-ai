import { describe, expect, test } from 'vitest'

import { type PreviewOccupancy, shiftPreview } from '@/features/discharges/shift-preview'

// Form values are local date-times, and occupancy instants are built from local times too, so the
// preview reads the same whatever zone the suite runs in. September 2026: the 22nd is a Tuesday.
const pad = (value: number) => String(value).padStart(2, '0')
const local = (day: number, hours: number, month = 9) =>
  `2026-${pad(month)}-${pad(day)}T${pad(hours)}:00`
const instant = (day: number, hours: number, month = 9) =>
  new Date(2026, month - 1, day, hours).toISOString()

const shift = (start: string, end: string) => ({ plannedStartAt: start, plannedEndAt: end })

const occupancy = (
  vesselName: string,
  start: string,
  end: string,
  status: 'PLANNED' | 'ACTIVE' = 'ACTIVE',
): PreviewOccupancy => ({
  discharge: { id: vesselName, vesselName, status },
  startAt: start,
  endAt: end,
})

const rounded = (value: number) => Number(value.toFixed(2))

describe('shiftPreview period', () => {
  test('opens the day before the dock frees up and pads forward to a week', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift('', '')],
      occupancy: [occupancy('MV Nordic Breeze', instant(17, 6), instant(20, 14))],
    })

    expect(preview.freeFrom).toBe(instant(20, 14))
    expect(preview.days.map((day) => day.label)).toEqual([
      'Sat 19',
      'Sun 20',
      'Mon 21',
      'Tue 22',
      'Wed 23',
      'Thu 24',
      'Fri 25',
    ])
  })

  test('opens on the expected start when nothing holds the dock before it', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift(local(22, 6), local(22, 14))],
      occupancy: [],
    })

    expect(preview.freeFrom).toBeNull()
    expect(preview.days[0].label).toBe('Tue 22')
    expect(preview.days).toHaveLength(7)
  })

  test('opens on a shift planned before the expected start', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift(local(21, 22), local(22, 6))],
      occupancy: [],
    })

    expect(preview.days[0].label).toBe('Mon 21')
  })

  test('grows past a week to reach the last shift, an end at midnight staying on its day', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift(local(22, 6), local(22, 14)), shift(local(30, 16), local(1, 0, 10))],
      occupancy: [],
    })

    expect(preview.days[0].label).toBe('Tue 22')
    expect(preview.days.at(-1)?.label).toBe('Wed 30')
    expect(preview.days).toHaveLength(9)
  })

  test('keeps each day on midnight across a change of clocks', () => {
    // Clocks go back in much of Europe during the night of 25 October 2026.
    const preview = shiftPreview({
      expectedStartAt: local(24, 6, 10),
      shifts: [shift(local(26, 6, 10), local(26, 14, 10))],
      occupancy: [],
    })

    expect(preview.days.slice(0, 4).map((day) => new Date(day.start).getHours())).toEqual([
      0, 0, 0, 0,
    ])
    expect(preview.days.slice(0, 4).map((day) => day.label)).toEqual([
      'Sat 24',
      'Sun 25',
      'Mon 26',
      'Tue 27',
    ])
  })
})

describe('shiftPreview occupancy', () => {
  test('frees the dock from the latest end among occupancies starting before the expected start', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [],
      occupancy: [
        occupancy('MV Early', instant(18, 6), instant(19, 6)),
        // Straddles the expected start: the dock is not free before this one leaves.
        occupancy('MV Straddling', instant(21, 6), instant(22, 12)),
        occupancy('MV Later', instant(26, 6), instant(27, 6), 'PLANNED'),
      ],
    })

    expect(preview.freeFrom).toBe(instant(22, 12))
  })

  test('clips occupancies to the period and drops those outside it', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [],
      occupancy: [
        occupancy('MV Long Stay', instant(10, 6), instant(20, 12)),
        occupancy('MV Far Away', instant(3, 6), instant(4, 6), 'PLANNED'),
        occupancy('MV Next', instant(25, 12), instant(27, 12), 'PLANNED'),
      ],
    })

    // Sat 19 → Fri 25: 7 days of 24 hours each.
    expect(preview.days[0].label).toBe('Sat 19')
    expect(preview.occupancies.map((item) => item.discharge.vesselName)).toEqual([
      'MV Long Stay',
      'MV Next',
    ])
    const [longStay, next] = preview.occupancies
    expect(longStay).toMatchObject({ leftPct: 0, clippedStart: true, clippedEnd: false })
    expect(rounded(longStay.widthPct)).toBe(rounded(((24 + 12) / (7 * 24)) * 100))
    expect(next).toMatchObject({ clippedStart: false, clippedEnd: true })
    expect(rounded(next.leftPct + next.widthPct)).toBe(100)
  })

  test('reads the parts of the dock row no occupancy covers as free', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [],
      occupancy: [
        occupancy('MV Nordic Breeze', instant(18, 0), instant(20, 0)),
        occupancy('MV Overlap', instant(19, 0), instant(21, 0), 'PLANNED'),
      ],
    })

    // Sun 20 → Sat 26: occupied until Mon 21 at midnight, then free.
    expect(preview.days[0].label).toBe('Sun 20')
    expect(preview.freeGaps.map((gap) => [rounded(gap.leftPct), rounded(gap.widthPct)])).toEqual([
      [rounded((1 / 7) * 100), rounded((6 / 7) * 100)],
    ])
  })

  test('still lays out the period, the expected start, and the shifts without occupancy', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift(local(22, 6), local(22, 14))],
      occupancy: null,
    })

    expect(preview.occupancies).toEqual([])
    expect(preview.freeGaps).toEqual([])
    expect(preview.freeFrom).toBeNull()
    expect(preview.days).toHaveLength(7)
    expect(preview.shifts).toHaveLength(1)
    expect(rounded(preview.expectedStart?.leftPct ?? -1)).toBe(rounded((6 / (7 * 24)) * 100))
  })
})

describe('shiftPreview shifts', () => {
  test('numbers each shift by its row, placed by its period', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift(local(23, 6), local(23, 14)), shift(local(22, 6), local(22, 14))],
      occupancy: [],
    })

    expect(
      preview.shifts.map((block) => [
        block.number,
        rounded(block.leftPct),
        rounded(block.widthPct),
      ]),
    ).toEqual([
      [1, rounded((30 / 168) * 100), rounded((8 / 168) * 100)],
      [2, rounded((6 / 168) * 100), rounded((8 / 168) * 100)],
    ])
  })

  test('leaves shifts without a valid period unscheduled', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [
        shift('', ''),
        shift(local(22, 6), ''),
        shift(local(22, 14), local(22, 6)),
        shift(local(22, 6), local(22, 6)),
        shift(local(22, 6), local(22, 14)),
      ],
      occupancy: [],
    })

    expect(preview.unscheduled).toEqual([1, 2, 3, 4])
    expect(preview.shifts.map((block) => block.number)).toEqual([5])
  })

  test('marks the breaks between consecutive shifts, never between overlapping ones', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [
        shift(local(22, 6), local(22, 14)),
        shift(local(22, 12), local(22, 20)),
        shift(local(23, 6), local(23, 14)),
      ],
      occupancy: [],
    })

    expect(preview.breaks.map((gap) => [rounded(gap.leftPct), rounded(gap.widthPct)])).toEqual([
      [rounded((20 / 168) * 100), rounded((10 / 168) * 100)],
    ])
  })

  test('sums the planned hours of scheduled shifts only', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [
        shift(local(22, 6), local(22, 14)),
        shift(local(22, 14), local(22, 21)),
        shift('', ''),
      ],
      occupancy: [],
    })

    expect(preview.summary).toEqual({ count: 2, duration: '15 h' })
  })

  test('has no summary until a shift is scheduled', () => {
    const preview = shiftPreview({
      expectedStartAt: local(22, 6),
      shifts: [shift('', '')],
      occupancy: [],
    })

    expect(preview.summary).toBeNull()
  })

  test('draws every shift of a long discharge, in order and with a width', () => {
    const shifts = Array.from({ length: 8 }, (_, index) =>
      shift(local(22 + index, 6), local(22 + index, 14)),
    )
    const preview = shiftPreview({ expectedStartAt: local(22, 6), shifts, occupancy: [] })

    expect(preview.days.at(-1)?.label).toBe('Tue 29')
    expect(preview.shifts.map((block) => block.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(preview.shifts.every((block) => block.widthPct > 0)).toBe(true)
    expect(preview.breaks).toHaveLength(7)
  })
})
