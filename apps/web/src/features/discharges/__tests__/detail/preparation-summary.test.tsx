import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')

const selectedTruck = {
  id: 'row-truck-1',
  truckId: 'truck-1',
  registration: 'AB-123-CD',
  truckStatus: 'AVAILABLE' as const,
  effectiveFrom: '2026-09-07T08:00:00.000Z',
  effectiveTo: null,
}

async function renderSummary(detail = buildDischargeDetail(ATLANTIC_DAWN)) {
  mockDischargeDetail({ user: ACTIVE_OBSERVER, details: [detail] })
  const view = renderDischargeDetail(detail.id)
  await screen.findByRole('heading', { level: 1, name: detail.vesselName })

  return view
}

function summaryRow(name: string) {
  const summary = screen.getByRole('region', { name: 'Preparation' })

  return within(summary).getByRole('link', { name }).closest('li') as HTMLElement
}

test('states what a planned discharge has prepared and the gaps left, to every reader', async () => {
  await renderSummary(
    buildDischargeDetail(ATLANTIC_DAWN, {
      productLots: [
        buildLot({ id: 'lot-1' }),
        buildLot({ id: 'lot-2', doorAssignments: [buildDoorPeriod()] }),
      ],
      shifts: [buildShift({ id: 'shift-1' }), buildShift({ id: 'shift-2' })],
    }),
  )

  expect(summaryRow('Product lots')).toHaveTextContent('2 product lots')
  expect(summaryRow('Product lots')).toHaveTextContent(
    '1 with no warehouse door currently assigned',
  )
  expect(summaryRow('Truck pool')).toHaveTextContent('No trucks reserved')
  expect(summaryRow('Shifts')).toHaveTextContent('2 shifts')
  expect(summaryRow('Shifts')).toHaveTextContent('2 planned shifts without a truck selected')
  expect(screen.getByRole('region', { name: 'Preparation' })).not.toHaveTextContent(/start/i)
})

test('names no gap once every section is prepared', async () => {
  await renderSummary(
    buildDischargeDetail(ATLANTIC_DAWN, {
      productLots: [buildLot({ doorAssignments: [buildDoorPeriod()] })],
      shifts: [buildShift({ trucks: [selectedTruck] })],
      truckPool: [buildPoolEntry()],
    }),
  )

  expect(summaryRow('Product lots')).toHaveTextContent('1 product lot')
  expect(summaryRow('Truck pool')).toHaveTextContent('1 truck reserved')
  expect(summaryRow('Shifts')).toHaveTextContent('1 shift')
  const summary = screen.getByRole('region', { name: 'Preparation' })
  expect(summary).not.toHaveTextContent(/without|no warehouse door|no trucks/i)
})

test('opens the section a summary row names', async () => {
  const user = userEvent.setup()
  const { router } = await renderSummary()

  await user.click(summaryRow('Truck pool').querySelector('a') as HTMLElement)

  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /^Truck pool/ })).toHaveAttribute('aria-selected', 'true')
  expect(router.state.location.search).toMatchObject({ tab: 'truck-pool' })
})

test.each([
  ['an active', listedDischarge('MV Ocean Cedar', 'ACTIVE')],
  ['a closed', listedDischarge('MV Loire Star', 'CLOSED')],
])('shows no preparation summary on %s discharge', async (_case, listed) => {
  await renderSummary(buildDischargeDetail(listed))

  expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Preparation' })).not.toBeInTheDocument()
})
