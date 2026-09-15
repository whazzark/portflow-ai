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
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw truck?' })

  expect(dialog).toHaveTextContent("AA-100-AA will be removed from this discharge's pool.")
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

test('withdraws the selected trucks together, then clears the selection', async () => {
  const state = mockTruckPlanning({ detail: PLANNED })
  renderDischargeTab(PLANNED.id, 'truck-pool')
  const region = await pool()

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select BB-200-BB' }))
  expect(within(region).getByRole('checkbox', { name: 'Select all held trucks' })).toHaveAttribute(
    'aria-checked',
    'mixed',
  )
  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select CC-300-CC' }))
  fireEvent.click(within(region).getByRole('button', { name: 'Withdraw (2)' }))

  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw 2 trucks?' })
  expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(await screen.findByText('2 trucks withdrawn')).toBeInTheDocument()
  expect(state.requests).toEqual([{ kind: 'withdraw', truckIds: ['truck-b', 'truck-c'] }])
  await waitFor(() =>
    expect(
      within(screen.getByRole('region', { name: 'Truck pool' })).queryByRole('button', {
        name: /^Withdraw \(/,
      }),
    ).not.toBeInTheDocument(),
  )
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
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw truck?' })
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
  const dialog = await screen.findByRole('alertdialog', { name: 'Withdraw truck?' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw' }))

  expect(await screen.findByText('Unable to withdraw trucks')).toBeInTheDocument()
  expect(screen.getByRole('alertdialog', { name: 'Withdraw truck?' })).toBeInTheDocument()
})
