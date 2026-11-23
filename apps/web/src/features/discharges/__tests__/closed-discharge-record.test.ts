import { describe, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '@/features/discharges/__tests__/support/fixtures'
import {
  closedDischargeSummary,
  closedDockTimeline,
  closedRecordPeriod,
} from '@/features/discharges/closed-discharge-record'
import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'

const closed = (overrides: Parameters<typeof buildDischargeDetail>[1] = {}) =>
  buildDischargeDetail(listedDischarge('MV Loire Star', 'CLOSED'), overrides)

describe('closed record period', () => {
  test('runs from the recorded start to the closure time', () => {
    const detail = closed({ startedAt: '2026-08-16T06:00:00.000Z' })

    expect(closedRecordPeriod(detail, '2026-08-17T22:00:00.000Z')).toEqual({
      startAt: '2026-08-16T06:00:00.000Z',
      endAt: '2026-08-17T22:00:00.000Z',
    })
  })

  test('leaves the end unrecorded until a closure time is given, never inferring one', () => {
    const detail = closed({
      startedAt: '2026-08-16T06:00:00.000Z',
      shifts: [buildShift({ status: 'COMPLETED', plannedEndAt: '2026-08-17T22:00:00.000Z' })],
    })

    expect(closedRecordPeriod(detail).endAt).toBeNull()
  })

  test("falls back on the earliest shift's actual start when the start is not recorded", () => {
    const detail = closed({
      startedAt: null,
      shifts: [
        buildShift({ id: 'late', actualStartAt: '2026-08-17T06:05:00.000Z' }),
        buildShift({ id: 'early', actualStartAt: '2026-08-16T06:10:00.000Z' }),
        buildShift({ id: 'never', actualStartAt: null }),
      ],
    })

    expect(closedRecordPeriod(detail).startAt).toBe('2026-08-16T06:10:00.000Z')
  })

  test('leaves the start unrecorded when neither the discharge nor a shift recorded one', () => {
    const detail = closed({ startedAt: null, shifts: [buildShift({ actualStartAt: null })] })

    expect(closedRecordPeriod(detail).startAt).toBeNull()
  })
})

/** A local time, so the day boundaries under test hold in whichever zone the suite runs. */
const local = (day: number, hours: number) => new Date(2026, 7, day, hours).toISOString()

describe('closed dock timeline', () => {
  const morning = buildShift({
    id: 'morning',
    status: 'COMPLETED',
    plannedStartAt: local(16, 6),
    plannedEndAt: local(16, 14),
    actualStartAt: local(16, 7),
  })
  const night = buildShift({
    id: 'night',
    status: 'COMPLETED',
    plannedStartAt: local(16, 22),
    plannedEndAt: local(17, 6),
    actualStartAt: null,
  })

  test('draws nothing for a discharge without shifts', () => {
    expect(closedDockTimeline(closed({ shifts: [] }))).toBeNull()
  })

  test('spans whole local days around the shifts, one tick per day', () => {
    const timeline = closedDockTimeline(closed({ shifts: [night, morning] }))

    expect(timeline?.axisStart).toEqual(new Date(2026, 7, 16))
    expect(timeline?.axisEnd).toEqual(new Date(2026, 7, 18))
    expect(timeline?.days.map((day) => [day.date, day.offset])).toEqual([
      [new Date(2026, 7, 16), 0],
      [new Date(2026, 7, 17), 0.5],
    ])
  })

  test('places each shift from its actual start, else its planned start, to its planned end', () => {
    const timeline = closedDockTimeline(closed({ shifts: [night, morning] }))
    const hour = 1 / 48

    expect(timeline?.blocks).toEqual([
      {
        shiftId: 'morning',
        startAt: local(16, 7),
        endAt: local(16, 14),
        offset: expect.closeTo(7 * hour),
        width: expect.closeTo(7 * hour),
        label: formatShiftPeriod(morning),
      },
      {
        shiftId: 'night',
        startAt: local(16, 22),
        endAt: local(17, 6),
        offset: expect.closeTo(22 * hour),
        width: expect.closeTo(8 * hour),
        label: formatShiftPeriod(night),
      },
    ])
  })

  test('keeps a shift that started after its planned end on the axis, as a mark at its start', () => {
    const late = buildShift({
      id: 'late',
      status: 'COMPLETED',
      plannedStartAt: local(16, 22),
      plannedEndAt: local(16, 23),
      actualStartAt: local(17, 7),
    })
    const timeline = closedDockTimeline(closed({ startedAt: null, shifts: [late] }))

    expect(timeline?.axisStart).toEqual(new Date(2026, 7, 17))
    expect(timeline?.axisEnd).toEqual(new Date(2026, 7, 18))
    expect(timeline?.blocks).toMatchObject([
      { offset: expect.closeTo(7 / 24), width: 0, endAt: local(17, 7) },
    ])
  })

  test('marks where the discharge started, and only when that start is known', () => {
    const started = closedDockTimeline(closed({ startedAt: local(16, 6), shifts: [morning] }))
    const unknown = closedDockTimeline(
      closed({ startedAt: null, shifts: [{ ...morning, actualStartAt: null }] }),
    )

    expect(started?.startedMarker).toBeCloseTo(6 / 24)
    expect(unknown?.startedMarker).toBeNull()
  })
})

describe('closed discharge summary', () => {
  const doorPeriod = (doorId: string, name: string) =>
    buildDoorPeriod({
      id: `period-${doorId}-${name}`,
      warehouseDoor: { id: doorId, name, status: 'AVAILABLE' },
    })

  test('counts the shifts, lots, customers and distinct trucks, with the expected total', () => {
    const summary = closedDischargeSummary(
      closed({
        shifts: [buildShift({ id: 'a' }), buildShift({ id: 'b' })],
        productLots: [
          buildLot({ id: 'lot-1', expectedQuantityTonnes: '1000.250' }),
          buildLot({ id: 'lot-2', expectedQuantityTonnes: '500.500' }),
          buildLot({
            id: 'lot-3',
            customer: { id: 'customer-other', name: 'Cérès', status: 'AVAILABLE' },
            expectedQuantityTonnes: '10.000',
          }),
        ],
        truckPool: [
          buildPoolEntry({ id: 'pool-1', truckId: 'truck-1' }),
          buildPoolEntry({ id: 'pool-2', truckId: 'truck-1' }),
          buildPoolEntry({ id: 'pool-3', truckId: 'truck-2' }),
        ],
      }),
    )

    expect(summary).toMatchObject({
      shifts: 2,
      lots: 3,
      customers: 2,
      expectedTotal: '1510.750',
      trucks: 2,
    })
  })

  test('lists every door the lots used once, by name', () => {
    const summary = closedDischargeSummary(
      closed({
        productLots: [
          buildLot({
            id: 'lot-1',
            doorAssignments: [
              doorPeriod('north', 'Porte Nord'),
              doorPeriod('main', 'Porte Principale'),
            ],
          }),
          buildLot({ id: 'lot-2', doorAssignments: [doorPeriod('north', 'Porte Nord')] }),
        ],
      }),
    )

    expect(summary.doors.map((door) => door.name)).toEqual(['Porte Nord', 'Porte Principale'])
  })

  test('gives the latest release once every truck was released, and none otherwise', () => {
    const released = (id: string, releasedAt: string | null) =>
      buildPoolEntry({ id, truckId: id, releasedAt })

    expect(
      closedDischargeSummary(
        closed({
          truckPool: [
            released('a', '2026-08-17T20:00:00.000Z'),
            released('b', '2026-08-17T22:00:00.000Z'),
          ],
        }),
      ).allReleasedAt,
    ).toBe('2026-08-17T22:00:00.000Z')
    expect(
      closedDischargeSummary(
        closed({ truckPool: [released('a', '2026-08-17T20:00:00.000Z'), released('b', null)] }),
      ).allReleasedAt,
    ).toBeNull()
  })

  test('reads zero everywhere for an empty discharge', () => {
    expect(closedDischargeSummary(closed())).toEqual({
      shifts: 0,
      lots: 0,
      customers: 0,
      expectedTotal: '0.000',
      doors: [],
      trucks: 0,
      allReleasedAt: null,
    })
  })
})
