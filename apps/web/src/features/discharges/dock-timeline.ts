import { formatShiftDay } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto, DockOccupancyDto } from '@/features/discharges/types'

type Shift = DischargeDetailDto['shifts'][number]

export type TimelineBlockState = 'COMPLETED' | 'ACTIVE' | 'PLANNED' | 'OCCUPANCY'

export type TimelineBlock = {
  /** The shift drawn, on the discharge's own lane. */
  shiftId?: string
  from: string
  to: string
  state: TimelineBlockState
  /** An active shift still under way past its planned end. */
  overrun: boolean
}

export type TimelineLane = {
  discharge: { id: string; vesselName: string; status: string; isCurrent: boolean }
  blocks: TimelineBlock[]
  /** The inter-shift breaks of the discharge's own lane, between shifts that do not follow on. */
  breaks: Array<{ from: string; to: string }>
}

export type DockTimeline = {
  window: { from: string; to: string }
  /** Each local day of the window, by its start and as the shift calendar names it. */
  days: Array<{ start: string; label: string }>
  now: string | null
  lanes: TimelineLane[]
  /** Where an instant stands along the window, as a percentage of its width. */
  offset: (instant: string) => number
}

const DAY_MS = 24 * 3_600_000

const startOfLocalDay = (time: number) => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)

  return date.getTime()
}

const nextLocalDay = (time: number) => {
  const date = new Date(time)
  date.setDate(date.getDate() + 1)

  return startOfLocalDay(date.getTime())
}

function shiftBlock(shift: Shift, now: number | null): TimelineBlock | null {
  const start = shift.actualStartAt ?? shift.plannedStartAt
  const end = shift.plannedEndAt
  if (!start || !end) {
    return null
  }

  if (shift.status === 'ACTIVE') {
    // Under way for as long as it has not been completed, whatever its plan said.
    const overrunTo = now !== null && now > Date.parse(end) ? new Date(now).toISOString() : null

    return {
      shiftId: shift.id,
      from: start,
      to: overrunTo ?? end,
      state: 'ACTIVE',
      overrun: overrunTo !== null,
    }
  }

  // A completed shift has no recorded end yet; its planned end stands in for it.
  return { shiftId: shift.id, from: start, to: end, state: shift.status, overrun: false }
}

/**
 * The dock as a started discharge sees it: its own shifts, completed, active, and planned, and the
 * other discharges holding the dock, over whole days from its start to its last planned end — or
 * to now, if it runs later. Now is `null` until the page knows it, as it does not while rendered on
 * the server.
 */
export function activeDockTimeline(
  discharge: Pick<DischargeDetailDto, 'id' | 'vesselName' | 'status' | 'startedAt' | 'shifts'>,
  occupancy: DockOccupancyDto[],
  nowDate: Date | null,
): DockTimeline {
  const now = nowDate?.getTime() ?? null
  const blocks = discharge.shifts
    .map((shift) => shiftBlock(shift, now))
    .filter((block): block is TimelineBlock => block !== null)

  const breaks: TimelineLane['breaks'] = []
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = blocks[index - 1]
    const next = blocks[index]
    if (Date.parse(next.from) > Date.parse(previous.to)) {
      breaks.push({ from: previous.to, to: next.from })
    }
  }

  const others: TimelineLane[] = occupancy
    .filter((entry) => entry.discharge.id !== discharge.id)
    .map((entry) => ({
      discharge: { ...entry.discharge, isCurrent: false },
      blocks: [{ from: entry.startAt, to: entry.endAt, state: 'OCCUPANCY', overrun: false }],
      breaks: [],
    }))

  const instants = [
    ...(discharge.startedAt ? [Date.parse(discharge.startedAt)] : []),
    ...blocks.flatMap((block) => [Date.parse(block.from), Date.parse(block.to)]),
    ...others.flatMap((lane) => [Date.parse(lane.blocks[0].from), Date.parse(lane.blocks[0].to)]),
    ...(now === null ? [] : [now]),
  ]
  const from = startOfLocalDay(Math.min(...instants))
  const latest = Math.max(...instants)
  const to = startOfLocalDay(latest) === latest ? latest : nextLocalDay(latest)

  const days: DockTimeline['days'] = []
  for (let day = from; day < to; day = nextLocalDay(day)) {
    days.push({ start: new Date(day).toISOString(), label: formatShiftDay(new Date(day)) })
  }

  return {
    window: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
    days,
    now: now !== null && now >= from && now <= to ? new Date(now).toISOString() : null,
    lanes: [
      {
        discharge: {
          id: discharge.id,
          vesselName: discharge.vesselName,
          status: discharge.status,
          isCurrent: true,
        },
        blocks,
        breaks,
      },
      ...others,
    ],
    offset: (instant) => ((Date.parse(instant) - from) / Math.max(to - from, DAY_MS)) * 100,
  }
}
