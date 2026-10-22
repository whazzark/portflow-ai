import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { formatShiftPeriod } from '@/features/discharges/discharge-detail-view'
import {
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

const EARLY = buildShift({
  id: 'shift-early',
  plannedStartAt: '2026-10-04T06:00:00.000Z',
  plannedEndAt: '2026-10-04T14:00:00.000Z',
  trucks: [
    {
      id: 'row-a',
      truckId: 'truck-a',
      registration: 'AA-100-AA',
      truckStatus: 'AVAILABLE',
      effectiveFrom: '2026-09-07T08:00:00.000Z',
      effectiveTo: null,
    },
  ],
})

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  truckPool: [
    buildPoolEntry({ id: 'pool-a', truckId: 'truck-a', registration: 'AA-100-AA' }),
    buildPoolEntry({ id: 'pool-b', truckId: 'truck-b', registration: 'BB-200-BB' }),
    buildPoolEntry({ id: 'pool-c', truckId: 'truck-c', registration: 'CC-300-CC' }),
  ],
  shifts: [EARLY],
})

function pool() {
  return screen.findByRole('region', { name: 'Truck pool' })
}

test('withdraws one truck after naming the planned shifts it leaves', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  fireEvent.click(within(await pool()).getByRole('button', { name: 'Withdraw AA-100-AA' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw AA-100-AA?' })

  expect(dialog).toHaveTextContent('AA-100-AA leaves the pool of MV Atlantic Dawn.')
  expect(dialog).toHaveTextContent('It is also removed from the 1 shift that uses it:')
  const shifts = within(dialog).getByRole('list')
  expect(shifts).toHaveTextContent(
    formatShiftPeriod({
      plannedStartAt: '2026-10-04T06:00:00.000Z',
      plannedEndAt: '2026-10-04T14:00:00.000Z',
    }),
  )

  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(await screen.findByText('Truck withdrawn')).toBeInTheDocument()
  expect(state.requests).toEqual([{ kind: 'withdraw', truckIds: ['truck-a'] }])
  expect(await pool()).not.toHaveTextContent('AA-100-AA')
})

function selectionBar() {
  return screen.queryByRole('toolbar', { name: 'Selected trucks' })
}

test('withdraws the selected trucks together from the selection bar, then clears it', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  expect(within(region).getByRole('checkbox', { name: 'Select all trucks' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  )
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select CC-300-CC' }))
  expect(within(region).queryByRole('button', { name: /^Withdraw \(/ })).not.toBeInTheDocument()

  const bar = selectionBar()
  expect(bar).toHaveTextContent('2 trucks selected')
  expect(bar).not.toHaveTextContent('BB-200-BB')
  expect(bar).not.toHaveTextContent('CC-300-CC')
  fireEvent.click(within(bar as HTMLElement).getByRole('button', { name: 'Withdraw' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw 2 trucks?' })
  expect(dialog).toHaveTextContent('BB-200-BB, CC-300-CC leave the pool of MV Atlantic Dawn.')
  expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(await screen.findByText('2 trucks withdrawn')).toBeInTheDocument()
  expect(state.requests).toEqual([{ kind: 'withdraw', truckIds: ['truck-b', 'truck-c'] }])
  await waitFor(() => expect(selectionBar()).not.toBeInTheDocument())
  // The bar's Withdraw left with the bar; focus lands on the table rather than the page.
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', { name: 'Truck pool' })).getByRole('checkbox', {
        name: 'Select all trucks',
      }),
    ).toHaveFocus(),
  )
  expect(
    within(screen.getByRole('region', { name: 'Truck pool' })).getByRole('checkbox', {
      name: 'Select AA-100-AA',
    }),
  ).not.toBeChecked()
})

test('shows the selection bar only while a truck is selected', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  expect(selectionBar()).not.toBeInTheDocument()
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  expect(selectionBar()).toHaveTextContent('1 truck selected')

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  expect(selectionBar()).not.toBeInTheDocument()
})

test('clears the whole selection from the bar and keeps focus on the table', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()
  const selectAll = within(region).getByRole('checkbox', { name: 'Select all trucks' })

  fireEvent.click(selectAll)
  expect(selectionBar()).toHaveTextContent('3 trucks selected')
  fireEvent.click(within(selectionBar() as HTMLElement).getByRole('button', { name: 'Clear' }))

  expect(selectionBar()).not.toBeInTheDocument()
  for (const checkbox of within(region).getAllByRole('checkbox')) {
    expect(checkbox).not.toBeChecked()
  }
  expect(selectAll).toHaveFocus()
})

test('keeps the selection when the withdrawal is cancelled', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(selectionBar() as HTMLElement).getByRole('button', { name: 'Withdraw' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw 2 trucks?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(selectionBar()).toHaveTextContent('2 trucks selected')
  expect(state.requests).toEqual([])
})

test('keeps the rest of the selection when one selected truck is withdrawn from its row', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select CC-300-CC' }))
  fireEvent.click(within(region).getByRole('button', { name: 'Withdraw BB-200-BB' }))
  const dialog = await screen.findByRole('alertdialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(await screen.findByText('Truck withdrawn')).toBeInTheDocument()
  await waitFor(() => expect(selectionBar()).toHaveTextContent('1 truck selected'))
})

test('closes and refreshes when the discharge has started meanwhile', async () => {
  const state = mockTruckPlanning({
    detail: PLANNED,
    respondToWithdraw: () => ({
      status: 409,
      body: {
        error: {
          code: 'E_DISCHARGE_NOT_PLANNED',
          message: 'Only a planned discharge can be corrected',
        },
      },
    }),
  })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  fireEvent.click(within(await pool()).getByRole('button', { name: 'Withdraw BB-200-BB' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw BB-200-BB?' })
  const before = state.detailRequests
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(
    await screen.findByText('This discharge has started and can no longer be corrected'),
  ).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  await waitFor(() => expect(state.detailRequests).toBeGreaterThan(before))
})

test('keeps the confirmation open when the withdrawal could not be sent', async () => {
  mockTruckPlanning({ detail: PLANNED, respondToWithdraw: () => 'network-error' })
  renderDischargeTab(PLANNED.id, 'truck-pool')

  fireEvent.click(within(await pool()).getByRole('button', { name: 'Withdraw BB-200-BB' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw BB-200-BB?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(await screen.findByText('Unable to withdraw trucks')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog', { name: 'Withdraw BB-200-BB?' })).toBeInTheDocument()
})

test('names the shifts several trucks leave together', async () => {
  mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select AA-100-AA' }))
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  fireEvent.click(within(selectionBar() as HTMLElement).getByRole('button', { name: 'Withdraw' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw 2 trucks?' })
  expect(dialog).toHaveTextContent('AA-100-AA, BB-200-BB leave the pool of MV Atlantic Dawn.')
  expect(dialog).toHaveTextContent('They are also removed from the 1 shift that uses them:')
  expect(within(within(dialog).getByRole('list')).getAllByRole('listitem')).toHaveLength(1)
})
