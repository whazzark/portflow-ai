import { describe, expect, test } from 'vitest'

import { activeDischargeDetail } from '@/features/discharges/__tests__/support/fixtures'
import { activeDockTimeline } from '@/features/discharges/dock-timeline'

const HOUR_MS = 3_600_000
const discharge = activeDischargeDetail()
const shift = (index: number) => discharge.shifts[index]
// Two hours into the active shift, the sixth.
const NOW = new Date(Date.parse(shift(5).actualStartAt ?? '') + 2 * HOUR_MS)

const OTHER = {
  discharge: { id: 'other-discharge', vesselName: 'MV Nordic Breeze', status: 'PLANNED' as const },
  startAt: shift(13).plannedStartAt ?? '',
  endAt: new Date(Date.parse(shift(13).plannedEndAt ?? '') + 24 * HOUR_MS).toISOString(),
}

describe('activeDockTimeline', () => {
  test('spans whole local days from the start of the discharge to its last planned end', () => {
    const timeline = activeDockTimeline(discharge, [], NOW)
    const from = new Date(timeline.window.from)
    const to = new Date(timeline.window.to)

    expect([from.getHours(), from.getMinutes()]).toEqual([0, 0])
    expect([to.getHours(), to.getMinutes()]).toEqual([0, 0])
    expect(from.getTime()).toBeLessThanOrEqual(Date.parse(discharge.startedAt ?? ''))
    expect(to.getTime()).toBeGreaterThanOrEqual(Date.parse(shift(13).plannedEndAt ?? ''))
    expect(timeline.days.length).toBe((to.getTime() - from.getTime()) / (24 * HOUR_MS))
  })

  test('draws each shift of the discharge in its own state, in order', () => {
    const [lane] = activeDockTimeline(discharge, [], NOW).lanes

    expect(lane.discharge).toMatchObject({ id: discharge.id, isCurrent: true })
    expect(lane.blocks.map((block) => block.state)).toEqual([
      ...Array(5).fill('COMPLETED'),
      'ACTIVE',
      ...Array(8).fill('PLANNED'),
    ])
    expect(lane.blocks[0]).toMatchObject({
      from: shift(0).actualStartAt,
      to: shift(0).plannedEndAt,
      overrun: false,
    })
    expect(lane.blocks[6]).toMatchObject({
      from: shift(6).plannedStartAt,
      to: shift(6).plannedEndAt,
    })
  })

  test('runs the active shift from its actual start to its planned end while it is on time', () => {
    const active = activeDockTimeline(discharge, [], NOW).lanes[0].blocks[5]

    expect(active).toMatchObject({
      state: 'ACTIVE',
      from: shift(5).actualStartAt,
      to: shift(5).plannedEndAt,
      overrun: false,
    })
  })

  test('stretches an overrunning active shift to now and says it overran', () => {
    const late = new Date(Date.parse(shift(5).plannedEndAt ?? '') + HOUR_MS)
    const active = activeDockTimeline(discharge, [], late).lanes[0].blocks[5]

    expect(active).toMatchObject({ to: late.toISOString(), overrun: true })
  })

  test('marks the breaks between shifts that do not follow on', () => {
    const spaced = activeDischargeDetail({
      shifts: [
        { ...shift(5) },
        {
          ...shift(6),
          plannedStartAt: new Date(
            Date.parse(shift(6).plannedStartAt ?? '') + HOUR_MS,
          ).toISOString(),
        },
      ],
    })

    const [lane] = activeDockTimeline(spaced, [], NOW).lanes

    expect(lane.breaks).toEqual([
      {
        from: shift(5).plannedEndAt,
        to: new Date(Date.parse(shift(6).plannedStartAt ?? '') + HOUR_MS).toISOString(),
      },
    ])
    expect(activeDockTimeline(discharge, [], NOW).lanes[0].breaks).toEqual([])
  })

  test('adds the other discharges on the dock after this one, never this one twice', () => {
    const self = {
      discharge: { id: discharge.id, vesselName: discharge.vesselName, status: 'ACTIVE' as const },
      startAt: shift(0).plannedStartAt ?? '',
      endAt: shift(13).plannedEndAt ?? '',
    }

    const { lanes } = activeDockTimeline(discharge, [self, OTHER], NOW)

    expect(lanes.map((lane) => lane.discharge.vesselName)).toEqual([
      'MV Ocean Cedar',
      'MV Nordic Breeze',
    ])
    expect(lanes[1].discharge.isCurrent).toBe(false)
    expect(lanes[1].blocks).toEqual([
      { from: OTHER.startAt, to: OTHER.endAt, state: 'OCCUPANCY', overrun: false },
    ])
  })

  test('keeps to the days of the discharge itself, whatever the other discharges on the dock', () => {
    const alone = activeDockTimeline(discharge, [], NOW).window

    expect(activeDockTimeline(discharge, [OTHER], NOW).window).toEqual(alone)
  })

  test('leaves out the other discharges that fall wholly outside those days', () => {
    const later = {
      discharge: { id: 'later', vesselName: 'MV Far Away', status: 'PLANNED' as const },
      startAt: new Date(Date.parse(OTHER.endAt) + 60 * 24 * HOUR_MS).toISOString(),
      endAt: new Date(Date.parse(OTHER.endAt) + 62 * 24 * HOUR_MS).toISOString(),
    }

    const { lanes } = activeDockTimeline(discharge, [OTHER, later], NOW)

    expect(lanes.map((lane) => lane.discharge.vesselName)).toEqual([
      'MV Ocean Cedar',
      'MV Nordic Breeze',
    ])
  })

  test('places now within the window, and leaves it out once the window is past', () => {
    expect(activeDockTimeline(discharge, [], NOW).now).toBe(NOW.toISOString())

    const longAfter = new Date(Date.parse(shift(13).plannedEndAt ?? '') + 30 * 24 * HOUR_MS)
    const timeline = activeDockTimeline(discharge, [], longAfter)
    expect(Date.parse(timeline.window.to)).toBeGreaterThanOrEqual(longAfter.getTime())
    expect(timeline.now).toBe(longAfter.toISOString())
  })

  test('positions an instant as a share of the window', () => {
    const timeline = activeDockTimeline(discharge, [], NOW)

    expect(timeline.offset(timeline.window.from)).toBe(0)
    expect(timeline.offset(timeline.window.to)).toBe(100)
  })
})

test('draws the active shift to its planned end before now is known', () => {
  const timeline = activeDockTimeline(discharge, [], null)

  expect(timeline.now).toBeNull()
  expect(timeline.lanes[0].blocks[5]).toMatchObject({ to: shift(5).plannedEndAt, overrun: false })
})
