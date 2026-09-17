import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import { fromDateTimeLocalValue, toDateTimeLocalValue } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  change,
  chooseOption,
  mockTruckPlanning,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const FIRST = {
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
}
const LAST = {
  plannedStartAt: '2026-10-05T06:00:00.000Z',
  plannedEndAt: '2026-10-05T14:00:00.000Z',
}

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  productLots: [
    buildLot({ id: 'lot-wheat', doorAssignments: [buildDoorPeriod({ id: 'wheat-a1' })] }),
  ],
  truckPool: [buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' })],
  shifts: [buildShift({ id: 'shift-1', ...FIRST }), buildShift({ id: 'shift-2', ...LAST })],
})

const ACTIVE = buildDischargeDetail(listedDischarge('MV Ocean Cedar', 'ACTIVE'), {
  shifts: [buildShift({ id: 'shift-running', status: 'ACTIVE', ...FIRST })],
})

async function openAddShift() {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(within(shifts).getByRole('button', { name: 'Add shift' }))

  return screen.findByRole('dialog', { name: 'Add shift' })
}

const submit = (sheet: HTMLElement) =>
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add shift' }))

async function fillPeriod(sheet: HTMLElement, start: string, end: string) {
  change(within(sheet).getByLabelText(/^Planned start/), toDateTimeLocalValue(start))
  change(within(sheet).getByLabelText(/^Planned end/), toDateTimeLocalValue(end))
  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
}

test('offers no shift addition to an observer', async () => {
  mockTruckPlanning({ user: ACTIVE_OBSERVER, detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  await within(shifts).findByRole('button', { name: `Shift ${formatShiftPeriod(FIRST)}` })
  expect(within(shifts).queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
})

test('offers the addition from the empty state of a discharge with no shift', async () => {
  const empty = { ...PLANNED, shifts: [] }
  mockTruckPlanning({ detail: empty })
  renderDischargeTab(empty.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  await within(shifts).findByText('No shifts planned')
  expect(within(shifts).getAllByRole('button', { name: 'Add shift' })).toHaveLength(2)
})

test('opens after the last shift, for as long, with every resource group', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  expect(within(sheet).getByLabelText(/^Planned start/)).toHaveValue(
    toDateTimeLocalValue(LAST.plannedEndAt),
  )
  expect(within(sheet).getByLabelText(/^Planned end/)).toHaveValue(
    toDateTimeLocalValue('2026-10-05T22:00:00.000Z'),
  )
  expect(await within(sheet).findByRole('checkbox', { name: 'Select AA-100-AA' })).not.toBeChecked()
  expect(
    within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' }),
  ).not.toBeChecked()
  expect(
    await within(sheet).findByRole('checkbox', { name: 'Select North scale' }),
  ).not.toBeChecked()
})

test('adds a shift between two others with its resources and opens it', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  const { router } = renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()
  const added = {
    plannedStartAt: '2026-10-04T14:00:00.000Z',
    plannedEndAt: '2026-10-04T22:00:00.000Z',
  }

  await fillPeriod(sheet, added.plannedStartAt, added.plannedEndAt)
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select Magasin A › Door A1' }))
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select North scale' }))
  submit(sheet)

  expect(await screen.findByText('Shift added')).toBeInTheDocument()
  expect(state.requests).toHaveLength(1)
  const [request] = state.requests
  expect(request).toMatchObject({
    kind: 'add-shift',
    body: {
      plannedStartAt: fromDateTimeLocalValue(toDateTimeLocalValue(added.plannedStartAt)),
      plannedEndAt: fromDateTimeLocalValue(toDateTimeLocalValue(added.plannedEndAt)),
      responsibleUserId: 'responsible-thomas',
      truckIds: ['truck-a'],
      warehouseDoorIds: ['door-a1'],
      weighingAreaIds: ['area-north'],
    },
  })
  const id = request.kind === 'add-shift' ? request.body.id : ''
  expect(id).toMatch(/^[0-9a-f-]{36}$/)

  const panel = await screen.findByRole('dialog', { name: `Shift ${formatShiftPeriod(added)}` })
  expect(panel).toHaveTextContent('Thomas Bernard')
  expect(within(panel).getByRole('list', { name: 'Trucks' })).toHaveTextContent('AA-100-AA')
  expect(router.state.location.search).toMatchObject({ tab: 'shifts', shiftId: id })
  // The open panel is modal, so the tabs behind it are hidden from the accessibility tree.
  expect(screen.getByRole('tab', { name: /Shifts/, hidden: true })).toHaveTextContent('3')
})

test('posts one addition when saving is clicked twice', async () => {
  const state = mockTruckPlanning({ detail: PLANNED, addShiftDelayMs: 200 })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openAddShift()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  const button = within(sheet).getByRole('button', { name: 'Add shift' })
  fireEvent.click(button)
  fireEvent.click(button)

  expect(await screen.findByText('Shift added')).toBeInTheDocument()
  expect(state.requests.filter((request) => request.kind === 'add-shift')).toHaveLength(1)
})

test('adds a shift to an active discharge without offering resources', async () => {
  const state = mockTruckPlanning({ detail: ACTIVE })
  renderDischargeTab(ACTIVE.id, 'shifts')
  const sheet = await openAddShift()

  expect(sheet).toHaveTextContent('Its resources are chosen once it is added.')
  expect(within(sheet).queryByRole('group', { name: /Trucks/ })).not.toBeInTheDocument()
  expect(within(sheet).queryByText('Weighing areas')).not.toBeInTheDocument()
  expect(within(sheet).queryByText('Warehouse doors')).not.toBeInTheDocument()

  await chooseOption(sheet, 'Responsible', 'Thomas Bernard')
  submit(sheet)

  expect(await screen.findByText('Shift added')).toBeInTheDocument()
  const [request] = state.requests
  expect(request.kind === 'add-shift' && request.body).not.toHaveProperty('truckIds')
  expect(request.kind === 'add-shift' && request.body).not.toHaveProperty('weighingAreaIds')
})

test('refuses before any request a shift starting before the active one', async () => {
  const state = mockTruckPlanning({ detail: ACTIVE })
  renderDischargeTab(ACTIVE.id, 'shifts')
  const sheet = await openAddShift()

  await fillPeriod(sheet, '2026-10-03T06:00:00.000Z', '2026-10-03T14:00:00.000Z')
  submit(sheet)

  expect(
    await within(sheet).findByText(
      `A new shift must start after shift ${formatShiftPeriod(FIRST)}`,
    ),
  ).toBeInTheDocument()
  await waitFor(() => expect(state.requests).toEqual([]))
})

test('offers no shift addition on a closed discharge', async () => {
  const closed = buildDischargeDetail(listedDischarge('MV Loire Star', 'CLOSED'), {
    shifts: [buildShift({ id: 'shift-done', status: 'COMPLETED', ...FIRST })],
  })
  mockTruckPlanning({ detail: closed })
  renderDischargeTab(closed.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  await within(shifts).findByRole('button', { name: `Shift ${formatShiftPeriod(FIRST)}` })
  expect(within(shifts).queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
})
