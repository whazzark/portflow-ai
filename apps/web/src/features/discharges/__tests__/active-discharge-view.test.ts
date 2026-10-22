import { describe, expect, test } from 'vitest'

import { activeDischargeDetail } from '@/features/discharges/__tests__/support/fixtures'
import { activeShiftSummary, dischargeProgress } from '@/features/discharges/active-discharge-view'

describe('activeShiftSummary', () => {
  test('names the active shift, its rank, the resources it holds now, and the next shift', () => {
    const summary = activeShiftSummary(activeDischargeDetail())

    expect(summary.state).toBe('ACTIVE')
    if (summary.state !== 'ACTIVE') {
      return
    }
    expect(summary.shift.id).toBe('shift-6')
    expect(summary.position).toEqual({ index: 6, total: 14 })
    expect(summary.resources.truckIds).toEqual(['truck-PN-552-PF', 'truck-QV-569-PF'])
    expect(summary.resources.warehouseDoors.map((door) => door.name)).toEqual([
      'Porte Douane',
      'Porte Nord',
    ])
    expect(summary.resources.weighingAreas).toEqual(['Pont-bascule Nord'])
    expect(summary.next?.shift.id).toBe('shift-7')
    expect(summary.next?.counts).toEqual({ trucks: 6, warehouseDoors: 1, weighingAreas: 1 })
  })

  test('names no next shift when the active shift is the last one', () => {
    const discharge = activeDischargeDetail()
    const summary = activeShiftSummary({ ...discharge, shifts: discharge.shifts.slice(0, 6) })

    expect(summary.state).toBe('ACTIVE')
    expect(summary.next).toBeNull()
  })

  test('between two shifts, names the last completed shift and the next planned one', () => {
    const discharge = activeDischargeDetail()
    const shifts = discharge.shifts.map((shift) =>
      shift.status === 'ACTIVE' ? { ...shift, status: 'COMPLETED' as const } : shift,
    )

    const summary = activeShiftSummary({ ...discharge, shifts })

    expect(summary.state).toBe('BETWEEN')
    if (summary.state !== 'BETWEEN') {
      return
    }
    expect(summary.last?.id).toBe('shift-6')
    expect(summary.next?.shift.id).toBe('shift-7')
  })

  test('between two shifts with nothing planned after the last one', () => {
    const discharge = activeDischargeDetail()
    const shifts = discharge.shifts
      .slice(0, 6)
      .map((shift) => ({ ...shift, status: 'COMPLETED' as const }))

    const summary = activeShiftSummary({ ...discharge, shifts })

    expect(summary).toMatchObject({ state: 'BETWEEN', next: null })
    expect(summary.state === 'BETWEEN' && summary.last?.id).toBe('shift-6')
  })

  test('with no shift at all, names neither a last nor a next shift', () => {
    expect(activeShiftSummary(activeDischargeDetail({ shifts: [] }))).toEqual({
      state: 'BETWEEN',
      last: null,
      next: null,
    })
  })
})

describe('dischargeProgress', () => {
  test('counts the shifts by state and tells when the last one is planned to end', () => {
    const discharge = activeDischargeDetail()

    expect(dischargeProgress(discharge).shifts).toEqual({
      total: 14,
      completed: 5,
      active: 1,
      planned: 8,
      plannedEnd: discharge.shifts[13].plannedEndAt,
    })
  })

  test('sums up the product lots and which of them hold a warehouse door now', () => {
    expect(dischargeProgress(activeDischargeDetail()).lots).toEqual({
      total: 5,
      customers: 5,
      expectedTonnage: '16790.500',
      withDoor: { count: 2, doorNames: ['Porte Douane', 'Porte Nord'] },
      withoutDoor: 3,
    })
  })

  test('names each door once, and leaves out a door whose assignment has ended', () => {
    const discharge = activeDischargeDetail()
    const [armor, baltic, boreal, cap, ceres] = discharge.productLots
    const ended = { ...boreal.doorAssignments[0], effectiveTo: '2026-09-15T00:00:00.000Z' }
    // Boréal's door has ended; Cap shares Armor's.
    const lots = [
      armor,
      baltic,
      { ...boreal, doorAssignments: [ended] },
      { ...cap, doorAssignments: armor.doorAssignments },
      ceres,
    ]

    expect(dischargeProgress({ ...discharge, productLots: lots }).lots).toMatchObject({
      withDoor: { count: 2, doorNames: ['Porte Douane'] },
      withoutDoor: 3,
    })
  })

  test('counts the trucks held and lists those released, with when', () => {
    const discharge = activeDischargeDetail()
    const released = discharge.truckPool.find((entry) => entry.releasedAt !== null)

    expect(dischargeProgress(discharge).trucks).toEqual({
      held: 9,
      released: [{ registration: 'CC-303-PF', releasedAt: released?.releasedAt }],
    })
  })
})
