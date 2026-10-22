import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  ACTIVE_OBSERVER,
  buildDischargeDetail,
  buildDockOccupation,
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

test('lists the dock first, then the lots, the truck pool, and the shifts', async () => {
  await renderSummary()

  const summary = screen.getByRole('region', { name: 'Preparation' })
  expect(
    within(summary)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Dock', 'Product lots', 'Truck pool', 'Shifts'])
  expect(summaryRow('Dock')).toHaveTextContent('Quai Nord')
  // Below the dock timeline, which the overview opens on.
  const regions = within(screen.getByRole('tabpanel')).getAllByRole('region')
  expect(regions.map((region) => within(region).getAllByRole('heading')[0].textContent)).toEqual([
    'Dock Quai Nord',
    'Preparation',
  ])
})

test('says in words when the dock is held by an active discharge, or archived', async () => {
  const view = await renderSummary(
    buildDischargeDetail(ATLANTIC_DAWN, {
      dockOccupations: [buildDockOccupation({ vesselName: 'MV Ocean Cedar' })],
    }),
  )
  expect(summaryRow('Dock')).toHaveTextContent('Held by MV Ocean Cedar (active)')
  view.unmount()

  await renderSummary(
    buildDischargeDetail(ATLANTIC_DAWN, {
      dock: { id: 'dock-nord', name: 'Quai Nord', status: 'ARCHIVED' },
    }),
  )
  expect(summaryRow('Dock')).toHaveTextContent('Dock archived')
})

test('brings focus to the dock timeline from the dock row', async () => {
  const user = userEvent.setup()
  await renderSummary()

  await user.click(within(summaryRow('Dock')).getByRole('link', { name: 'Dock' }))

  expect(screen.getByRole('region', { name: 'Dock Quai Nord' })).toHaveFocus()
})
