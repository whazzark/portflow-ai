import type { DateTime } from 'luxon'

import type { ShiftStatus } from '#models/shift'

/** A shift as an active discharge's row names it: its position, its period, who answers for it. */
export type ShiftSummary = {
  id: string
  sequence: number
  plannedStartAt: DateTime
  plannedEndAt: DateTime
  responsible: { id: string; firstName: string; lastName: string }
}

export type ListedShift = ShiftSummary & { status: ShiftStatus }

function toSummary({ status: _status, ...shift }: ListedShift): ShiftSummary {
  return shift
}

/**
 * The shift in progress, and the first one still planned. A discharge has at most one active shift
 * at a time, and between two shifts it has none: the row then names the shift that comes next
 * rather than presenting a completed or planned one as running.
 */
export function pickListShifts(shifts: ReadonlyArray<ListedShift>) {
  const active = shifts.find((shift) => shift.status === 'ACTIVE')
  const [next] = shifts
    .filter((shift) => shift.status === 'PLANNED')
    .sort((left, right) => left.sequence - right.sequence)

  return {
    activeShift: active ? toSummary(active) : null,
    nextShift: next ? toSummary(next) : null,
  }
}
