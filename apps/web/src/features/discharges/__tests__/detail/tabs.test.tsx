import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import { formatDateTime } from '@/helpers/dates'
import { renderApp } from '@/test/render-app'
import {
  buildDischargeDetail,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeDetail,
  mockTruckPlanning,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const PLANNED = buildDischargeDetail(listedDischarge('MV Atlantic Dawn', 'PLANNED'), {
  expectedTonnage: '2000.000',
  productLots: [buildLot({ id: 'lot-1' }), buildLot({ id: 'lot-2' })],
  shifts: [buildShift({ id: 'shift-1' }), buildShift({ id: 'shift-2' })],
  truckPool: [
    buildPoolEntry({ id: 'pool-held', truckId: 'truck-held', registration: 'AA-100-AA' }),
    buildPoolEntry({
      id: 'pool-released',
      truckId: 'truck-released',
      registration: 'CC-300-CC',
      releasedAt: '2026-09-08T08:00:00.000Z',
    }),
  ],
})

function tabNames() {
  return within(screen.getByRole('tablist', { name: 'Discharge sections' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent)
}

test('opens on the overview, with the sections in preparation order and their counts', async () => {
  mockDischargeDetail({ details: [PLANNED] })

  renderDischargeDetail(PLANNED.id)

  expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(tabNames()).toEqual(['Overview', 'Product lots (2)', 'Truck pool (1)', 'Shifts (2)'])
  expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Product lots' })).not.toBeInTheDocument()
})

test('opens the section the address names', async () => {
  mockDischargeDetail({ details: [PLANNED] })

  renderDischargeTab(PLANNED.id, 'shifts')

  expect(await screen.findByRole('region', { name: 'Shifts' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Shifts (2)' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument()
})

test('falls back to the overview for a section it does not know', async () => {
  mockDischargeDetail({ details: [PLANNED] })

  renderDischargeDetail(PLANNED.id, '?tab=nope')

  expect(await screen.findByRole('region', { name: 'Overview' })).toBeInTheDocument()
  expect(screen.queryByText('Discharge not found')).not.toBeInTheDocument()
})

test('keeps the chosen section in the address, without reading the discharge again', {
  timeout: 15000,
}, async () => {
  const user = userEvent.setup()
  const state = mockTruckPlanning({ detail: PLANNED })

  // biome-ignore lint/security/noSecrets: a shared consultation address, not a credential
  const { router } = renderDischargeDetail(PLANNED.id, '?status=planned&search=Dawn')
  await screen.findByRole('region', { name: 'Overview' })
  const readsBefore = state.detailRequests

  await user.click(screen.getByRole('tab', { name: 'Truck pool (1)' }))

  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
  expect(router.state.location.search).toMatchObject({
    search: 'Dawn',
    status: 'planned',
    tab: 'truck-pool',
  })
  expect(state.detailRequests).toBe(readsBefore)

  await user.click(screen.getByRole('tab', { name: 'Overview' }))
  await screen.findByRole('region', { name: 'Overview' })
  expect(router.state.location.search).not.toHaveProperty('tab')

  // A reload is a fresh app on the same address.
  router.history.back()
  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
  const { href } = router.state.location
  cleanup()
  mockDischargeDetail({ details: [PLANNED] })
  renderApp(href)
  expect(await screen.findByRole('region', { name: 'Truck pool' })).toBeInTheDocument()
})

test('gives a closed discharge pool no count', async () => {
  const closed = buildDischargeDetail(listedDischarge('MV Loire Star', 'CLOSED'), {
    truckPool: [buildPoolEntry()],
  })
  mockDischargeDetail({ details: [closed] })

  renderDischargeDetail(closed.id)

  expect(await screen.findByRole('tab', { name: 'Truck pool' })).toBeInTheDocument()
})

test('updates a count once a change is accepted', async () => {
  mockTruckPlanning({ detail: PLANNED })

  renderDischargeTab(PLANNED.id, 'truck-pool')
  const pool = await screen.findByRole('region', { name: 'Truck pool' })
  fireEvent.click(within(pool).getByRole('button', { name: 'Add trucks' }))
  const sheet = await screen.findByRole('dialog', { name: 'Add trucks' })
  fireEvent.click(await within(sheet).findByRole('checkbox', { name: 'Select CE-101-DR' }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Reserve' }))

  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Truck pool (2)' })).toBeInTheDocument(),
  )
})

test.each(['product-lots', 'truck-pool', 'shifts'] as const)(
  'keeps the discharge facts above the %s section',
  async (tab) => {
    mockDischargeDetail({ details: [PLANNED] })

    renderDischargeTab(PLANNED.id, tab)

    const heading = await screen.findByRole('heading', { level: 1, name: 'MV Atlantic Dawn' })
    expect(heading.parentElement).toHaveTextContent('Planned')
    // Read beside the heading: a section may repeat one of these facts, as the lots' total does.
    const facts = within(heading.parentElement?.parentElement as HTMLElement)
    expect(facts.getByText(PLANNED.dock.name)).toBeInTheDocument()
    expect(facts.getByText(formatDateTime(PLANNED.expectedStartAt))).toBeInTheDocument()
    expect(facts.getByText(formatTonnes('2000.000'))).toBeInTheDocument()
  },
)
