import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { toDateTimeLocalValue } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

// Local times, so the columns read the same whatever zone the suite runs in.
const at = (day: number, hours: number) => new Date(2026, 9, day, hours).toISOString()

const FIRST = { plannedStartAt: at(4, 6), plannedEndAt: at(4, 14) }

const VESSELS = {
  PLANNED: 'MV Atlantic Dawn',
  ACTIVE: 'MV Ocean Cedar',
  CLOSED: 'MV Loire Star',
} as const satisfies Record<DischargeDetailDto['status'], string>

function withShifts(
  status: DischargeDetailDto['status'],
  overrides: Partial<DischargeDetailDto> = {},
) {
  return buildDischargeDetail(listedDischarge(VESSELS[status], status), {
    expectedStartAt: FIRST.plannedStartAt,
    truckPool: [buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' })],
    shifts: [buildShift({ id: 'shift-1', ...FIRST })],
    ...overrides,
  })
}

const PLANNED = withShifts('PLANNED')

// jsdom lays nothing out, so the calendar is given a week of 100px columns and 32px hours.
const COLUMN_PX = 100
const HOUR_PX = 32
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 7 * COLUMN_PX,
    bottom: 24 * HOUR_PX,
    width: 7 * COLUMN_PX,
    height: 24 * HOUR_PX,
    toJSON: () => ({}),
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

const point = (column: number, hours: number) => ({
  button: 0,
  pointerId: 1,
  pointerType: 'mouse',
  clientX: column * COLUMN_PX + COLUMN_PX / 2,
  clientY: hours * HOUR_PX,
})

async function calendarList() {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  await within(shifts).findByRole('button', { name: `Shift ${formatShiftPeriod(FIRST)}` })

  return within(shifts).getByRole('list', { name: 'Shift calendar' })
}

test('opens the addition with the period drawn over a column', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 14))
  fireEvent.pointerMove(list, point(2, 18))
  fireEvent.pointerMove(list, point(2, 22))
  fireEvent.pointerUp(list, point(2, 22))

  const sheet = await screen.findByRole('dialog', { name: 'Add shift' })
  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(
    toDateTimeLocalValue(at(6, 14)),
  )
  expect(within(sheet).getByLabelText(/^Planned end/)).toHaveValue(toDateTimeLocalValue(at(6, 22)))
})

test('draws a night shift across midnight', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 22))
  fireEvent.pointerMove(list, point(3, 6))
  fireEvent.pointerUp(list, point(3, 6))

  const sheet = await screen.findByRole('dialog', { name: 'Add shift' })
  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(
    toDateTimeLocalValue(at(6, 22)),
  )
  expect(within(sheet).getByLabelText(/^Planned end/)).toHaveValue(toDateTimeLocalValue(at(7, 6)))
})

test('gives a press the last shift’s duration', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 10))
  fireEvent.pointerUp(list, point(2, 10))

  const sheet = await screen.findByRole('dialog', { name: 'Add shift' })
  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(
    toDateTimeLocalValue(at(6, 10)),
  )
  expect(within(sheet).getByLabelText(/^Planned end/)).toHaveValue(toDateTimeLocalValue(at(6, 18)))
})

test('also draws on a discharge under way', async () => {
  const active = withShifts('ACTIVE', {
    shifts: [buildShift({ id: 'shift-1', status: 'ACTIVE', ...FIRST })],
  })
  mockTruckPlanning({ detail: active })
  renderDischargeTab(active.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 14))
  fireEvent.pointerUp(list, point(2, 22))

  expect(await screen.findByRole('dialog', { name: 'Add shift' })).toBeInTheDocument()
})

test('leaves a finger to scroll the calendar', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, { ...point(2, 14), pointerType: 'touch' })
  fireEvent.pointerUp(list, { ...point(2, 22), pointerType: 'touch' })

  expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('drops a drawing when Escape is pressed', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 14))
  fireEvent.pointerMove(list, point(2, 22))
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.pointerUp(list, point(2, 22))

  expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('opens a shift pressed on the calendar rather than drawing over it', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()
  const block = within(list).getByRole('button', { name: `Shift ${formatShiftPeriod(FIRST)}` })

  fireEvent.pointerDown(block, point(0, 8))
  fireEvent.pointerUp(block, point(0, 8))
  fireEvent.click(block)

  expect(
    await screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(FIRST)}` }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('draws nothing for an observer', async () => {
  mockTruckPlanning({ user: ACTIVE_OBSERVER, detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 14))
  fireEvent.pointerUp(list, point(2, 22))

  expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('draws nothing on a closed discharge', async () => {
  const closed = withShifts('CLOSED', {
    shifts: [buildShift({ id: 'shift-1', status: 'COMPLETED', ...FIRST })],
  })
  mockTruckPlanning({ detail: closed })
  renderDischargeTab(closed.id, 'shifts')
  const list = await calendarList()

  fireEvent.pointerDown(list, point(2, 14))
  fireEvent.pointerUp(list, point(2, 22))

  expect(screen.queryByRole('dialog', { name: 'Add shift' })).not.toBeInTheDocument()
})
