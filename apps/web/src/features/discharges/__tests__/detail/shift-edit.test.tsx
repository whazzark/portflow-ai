import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
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

const PERIOD = formatShiftPeriod({
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
})
const EDIT_NAME = `Edit trucks for shift ${PERIOD}`

const current = (
  truckId: string,
  registration: string,
  truckStatus: 'AVAILABLE' | 'SUSPENDED' = 'AVAILABLE',
) => ({
  id: `row-${truckId}`,
  truckId,
  registration,
  truckStatus,
  effectiveFrom: '2026-09-07T08:00:00.000Z',
  effectiveTo: null,
})

const POOL = [
  buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' }),
  buildPoolEntry({ id: 'pool-b', truckId: 'truck-b', registration: 'BB-200-BB' }),
  buildPoolEntry({
    id: 'pool-s',
    truckId: 'truck-s',
    registration: 'SU-300-SP',
    truckStatus: 'SUSPENDED',
  }),
  buildPoolEntry({
    id: 'pool-idle',
    truckId: 'truck-idle',
    registration: 'ID-400-LE',
    truckStatus: 'SUSPENDED',
  }),
]

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  truckPool: POOL,
  shifts: [
    buildShift({
      id: 'shift-1',
      trucks: [current('truck-a', 'AA-100-AA'), current('truck-s', 'SU-300-SP', 'SUSPENDED')],
    }),
    buildShift({
      id: 'shift-started',
      status: 'ACTIVE',
      plannedStartAt: '2026-10-05T06:00:00.000Z',
      plannedEndAt: '2026-10-05T14:00:00.000Z',
    }),
  ],
})

// The discharge opens on its shift under way, so the planned one is chosen on the calendar first.
async function openShiftTrucks() {
  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  fireEvent.click(within(shifts).getByRole('button', { name: `Shift ${PERIOD}` }))
  fireEvent.click(await within(shifts).findByRole('button', { name: EDIT_NAME }))

  return screen.findByRole('dialog', { name: 'Shift trucks' })
}

test('offers the choice only on planned shifts, and never to an observer', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  const started = formatShiftPeriod({
    plannedStartAt: '2026-10-05T06:00:00.000Z',
    plannedEndAt: '2026-10-05T14:00:00.000Z',
  })
  expect(within(shifts).getByRole('article')).toHaveAccessibleName(`Shift ${started}`)
  expect(within(shifts).queryByRole('button', { name: /^Edit trucks/ })).not.toBeInTheDocument()

  fireEvent.click(within(shifts).getByRole('button', { name: `Shift ${PERIOD}` }))
  expect(await within(shifts).findByRole('button', { name: EDIT_NAME })).toBeInTheDocument()
})

test('shows no truck selection to an observer', async () => {
  mockTruckPlanning({ user: ACTIVE_OBSERVER, detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')

  const shifts = await screen.findByRole('region', { name: 'Shifts' })
  expect(within(shifts).queryByRole('button', { name: /^Edit trucks/ })).not.toBeInTheDocument()
})

test('replaces the shift trucks with the selection chosen from the pool', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()

  expect(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' })).toBeChecked()
  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).not.toBeChecked()
  expect(
    within(sheet).queryByRole('checkbox', { name: 'Select ID-400-LE' }),
  ).not.toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Shift trucks' })).not.toBeInTheDocument(),
  )
  expect(await screen.findByText('Shift trucks updated')).toBeInTheDocument()
  expect(state.requests).toEqual([
    { kind: 'shiftTrucks', shiftId: 'shift-1', truckIds: ['truck-b', 'truck-s'] },
  ])
  const shift = within(screen.getByRole('region', { name: 'Shifts' })).getByRole('article', {
    name: `Shift ${PERIOD}`,
  })
  const trucks = within(shift).getByRole('list', { name: 'Trucks' })
  expect(trucks).toHaveTextContent('BB-200-BB')
  expect(trucks).not.toHaveTextContent('AA-100-AA')
})

test('lets a suspended truck already selected go, but not be chosen again', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()

  const suspended = within(sheet).getByRole('checkbox', { name: 'Select SU-300-SP' })
  expect(suspended).toBeChecked()
  fireEvent.click(suspended)

  expect(suspended).not.toBeChecked()
  expect(suspended).toHaveAttribute('aria-disabled', 'true')
  expect(within(sheet).getByText('Suspended trucks cannot be newly selected')).toBeInTheDocument()
})

test('selects every truck it can at once', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select all' }))

  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).toBeChecked()
  expect(within(sheet).getByText('3 selected')).toBeInTheDocument()
})

test('points to the pool when the discharge holds no truck', async () => {
  const empty = { ...PLANNED, truckPool: [], shifts: [buildShift({ id: 'shift-1' })] }
  mockTruckPlanning({ detail: empty })
  renderDischargeTab(empty.id, 'shifts')
  const sheet = await openShiftTrucks()

  expect(within(sheet).getByText('No trucks reserved')).toBeInTheDocument()
  expect(within(sheet).getByRole('button', { name: 'Save' })).toBeDisabled()

  fireEvent.click(within(sheet).getByRole('link', { name: 'Go to truck pool' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
})

test('closes and refreshes when the shift is no longer planned', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToShiftTrucks: () => ({
      status: 404,
      body: { error: { code: 'E_SHIFT_NOT_FOUND', message: 'Shift not found' } },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()
  const before = state.detailRequests

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('This shift is no longer planned')).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Shift trucks' })).not.toBeInTheDocument(),
  )
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(before))
})

test('closes when the discharge has started meanwhile', async () => {
  mockTruckPlanning({
    detail: PLANNED,
    respondToShiftTrucks: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_NOT_PLANNED',
          message: 'Only a planned discharge can be corrected',
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
})

test('keeps the selection when it could not be saved', async () => {
  mockTruckPlanning({ detail: PLANNED, respondToShiftTrucks: () => 'network-error' })
  renderDischargeTab(PLANNED.id, 'shifts')
  const sheet = await openShiftTrucks()

  fireEvent.click(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Unable to update shift trucks')).toBeInTheDocument()
  expect(within(sheet).getByRole('checkbox', { name: 'Select BB-200-BB' })).toBeChecked()
})
