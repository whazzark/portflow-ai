import { describe, expect, test } from 'vitest'

import {
  buildDischargeDetail,
  buildDockOccupation,
  buildShift,
  listedDischarge,
} from '@/features/discharges/__tests__/support/fixtures'
import { dockTimeline } from '@/features/discharges/dock-timeline'
import type { DischargeDetailDto } from '@/features/discharges/types'

const HOUR = 3_600_000
const at = (iso: string) => Date.parse(iso)
const planned = listedDischarge('MV Atlantic Dawn', 'PLANNED')

/** Two eight-hour shifts with a sixteen-hour gap: 4 Oct 06–14, then 5 Oct 06–14 UTC. */
function detail(overrides: Partial<DischargeDetailDto> = {}) {
  return buildDischargeDetail(planned, {
    expectedStartAt: '2026-10-04T06:00:00.000Z',
    shifts: [
      buildShift({
        id: 'shift-second',
        plannedStartAt: '2026-10-05T06:00:00.000Z',
        plannedEndAt: '2026-10-05T14:00:00.000Z',
      }),
      buildShift({
        id: 'shift-first',
        plannedStartAt: '2026-10-04T06:00:00.000Z',
        plannedEndAt: '2026-10-04T14:00:00.000Z',
      }),
    ],
    ...overrides,
  })
}

const NOW_INSIDE = at('2026-10-04T10:00:00.000Z')

describe('span', () => {
  test('pads the planned period by a tenth of its length, at least two hours', () => {
    const timeline = dockTimeline(detail(), NOW_INSIDE)

    // 32 hours planned: a tenth is 3.2 hours.
    expect(timeline.span).toEqual({
      startAt: at('2026-10-04T06:00:00.000Z') - 3.2 * HOUR,
      endAt: at('2026-10-05T14:00:00.000Z') + 3.2 * HOUR,
    })
  })

  test('keeps two hours either side of a short plan', () => {
    const timeline = dockTimeline(
      detail({
        shifts: [
          buildShift({
            plannedStartAt: '2026-10-04T06:00:00.000Z',
            plannedEndAt: '2026-10-04T10:00:00.000Z',
          }),
        ],
      }),
      NOW_INSIDE,
    )

    expect(timeline.span).toEqual({
      startAt: at('2026-10-04T04:00:00.000Z'),
      endAt: at('2026-10-04T12:00:00.000Z'),
    })
  })

  test('centres on the expected start while no shift is planned', () => {
    const timeline = dockTimeline(detail({ shifts: [] }), NOW_INSIDE)

    // Twelve hours either side, then a tenth of that day padded on.
    expect(timeline.span).toEqual({
      startAt: at('2026-10-03T18:00:00.000Z') - 2.4 * HOUR,
      endAt: at('2026-10-04T18:00:00.000Z') + 2.4 * HOUR,
    })
    expect(timeline.shifts).toEqual([])
    expect(timeline.gaps).toEqual([])
  })
})

describe('now and the expected start', () => {
  test('places now and the expected start inside the span', () => {
    const timeline = dockTimeline(detail(), NOW_INSIDE)
    const { startAt, endAt } = timeline.span
    const position = (instant: number) => (instant - startAt) / (endAt - startAt)

    expect(timeline.now).toEqual({ kind: 'INSIDE', at: NOW_INSIDE, position: position(NOW_INSIDE) })
    expect(timeline.expectedStart).toEqual({
      at: at('2026-10-04T06:00:00.000Z'),
      position: position(at('2026-10-04T06:00:00.000Z')),
    })
  })

  test('says whether now lies before or after the span', () => {
    expect(dockTimeline(detail(), at('2026-09-01T00:00:00.000Z')).now).toEqual({ kind: 'BEFORE' })
    expect(dockTimeline(detail(), at('2026-11-01T00:00:00.000Z')).now).toEqual({ kind: 'AFTER' })
  })
})

describe('shifts and gaps', () => {
  test('orders the shifts and names the gap between them with its length', () => {
    const timeline = dockTimeline(detail(), NOW_INSIDE)

    expect(timeline.shifts.map((shift) => shift.id)).toEqual(['shift-first', 'shift-second'])
    expect(timeline.gaps).toEqual([
      expect.objectContaining({
        startAt: at('2026-10-04T14:00:00.000Z'),
        endAt: at('2026-10-05T06:00:00.000Z'),
        durationMinutes: 16 * 60,
      }),
    ])
  })

  test('finds no gap between touching or overlapping shifts', () => {
    const timeline = dockTimeline(
      detail({
        shifts: [
          buildShift({
            id: 'a',
            plannedStartAt: '2026-10-04T06:00:00.000Z',
            plannedEndAt: '2026-10-04T14:00:00.000Z',
          }),
          buildShift({
            id: 'b',
            plannedStartAt: '2026-10-04T14:00:00.000Z',
            plannedEndAt: '2026-10-04T22:00:00.000Z',
          }),
          buildShift({
            id: 'c',
            plannedStartAt: '2026-10-04T20:00:00.000Z',
            plannedEndAt: '2026-10-05T04:00:00.000Z',
          }),
        ],
      }),
      NOW_INSIDE,
    )

    expect(timeline.gaps).toEqual([])
  })
})

describe('occupations', () => {
  test('says the dock is free when no other discharge is on it', () => {
    const timeline = dockTimeline(detail(), NOW_INSIDE)

    expect(timeline.occupations).toEqual([])
    expect(timeline.dockFree).toBe(true)
  })

  test('draws an active discharge from its start to its planned end, overlapping this plan', () => {
    const timeline = dockTimeline(
      detail({
        dockOccupations: [
          buildDockOccupation({
            startedAt: '2026-10-03T06:00:00.000Z',
            plannedEndAt: '2026-10-04T10:00:00.000Z',
          }),
        ],
      }),
      NOW_INSIDE,
    )

    expect(timeline.dockFree).toBe(false)
    expect(timeline.occupations).toEqual([
      expect.objectContaining({
        dischargeId: 'discharge-holder',
        status: 'ACTIVE',
        startAt: at('2026-10-03T06:00:00.000Z'),
        endAt: at('2026-10-04T10:00:00.000Z'),
        from: 0,
        clippedStart: true,
        clippedEnd: false,
        openEnded: false,
        pointOnly: false,
        overlapsPlannedPeriod: true,
      }),
    ])
  })

  test('leaves an active discharge open-ended when no later end is planned', () => {
    for (const plannedEndAt of [null, '2026-10-03T05:00:00.000Z']) {
      const [occupation] = dockTimeline(
        detail({
          dockOccupations: [
            buildDockOccupation({ startedAt: '2026-10-04T08:00:00.000Z', plannedEndAt }),
          ],
        }),
        NOW_INSIDE,
      ).occupations

      expect(occupation).toEqual(
        expect.objectContaining({
          endAt: null,
          openEnded: true,
          to: 1,
          overlapsPlannedPeriod: true,
        }),
      )
    }
  })

  test('draws a planned discharge over its planned period, or at its expected start without one', () => {
    const timeline = dockTimeline(
      detail({
        dockOccupations: [
          buildDockOccupation({
            dischargeId: 'later',
            status: 'PLANNED',
            startedAt: null,
            plannedStartAt: '2026-10-05T16:00:00.000Z',
            plannedEndAt: '2026-10-05T17:00:00.000Z',
          }),
          buildDockOccupation({
            dischargeId: 'unplanned',
            status: 'PLANNED',
            startedAt: null,
            expectedStartAt: '2026-10-04T12:00:00.000Z',
            plannedStartAt: null,
            plannedEndAt: null,
          }),
        ],
      }),
      NOW_INSIDE,
    )

    expect(timeline.occupations).toEqual([
      expect.objectContaining({
        dischargeId: 'later',
        pointOnly: false,
        overlapsPlannedPeriod: false,
      }),
      expect.objectContaining({
        dischargeId: 'unplanned',
        startAt: at('2026-10-04T12:00:00.000Z'),
        endAt: at('2026-10-04T12:00:00.000Z'),
        pointOnly: true,
        overlapsPlannedPeriod: true,
      }),
    ])
  })

  test('drops the discharges that fall outside the span', () => {
    const timeline = dockTimeline(
      detail({
        dockOccupations: [
          buildDockOccupation({
            status: 'PLANNED',
            startedAt: null,
            plannedStartAt: '2026-12-01T06:00:00.000Z',
            plannedEndAt: '2026-12-02T06:00:00.000Z',
          }),
        ],
      }),
      NOW_INSIDE,
    )

    expect(timeline.occupations).toEqual([])
    expect(timeline.dockFree).toBe(true)
  })
})
