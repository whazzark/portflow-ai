import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { formatDateTime } from '@/helpers/dates'
import {
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildDoorPeriod,
  buildLot,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import {
  allowFormJourneyTime,
  mockDischargeDetail,
  renderDischargeDetail,
  renderDischargeTab,
} from '../support/test-helpers'

allowFormJourneyTime()

const LOIRE_STAR = listedDischarge('MV Loire Star', 'CLOSED')

const CLOSED = buildDischargeDetail(LOIRE_STAR, {
  vesselComment: 'Draught restricted at low tide',
  expectedTonnage: '1510.750',
  startedAt: '2026-08-16T06:00:00.000Z',
  shifts: [
    buildShift({
      id: 'shift-1',
      status: 'COMPLETED',
      plannedStartAt: '2026-08-16T06:00:00.000Z',
      plannedEndAt: '2026-08-16T14:00:00.000Z',
      actualStartAt: '2026-08-16T06:00:00.000Z',
    }),
    buildShift({
      id: 'shift-2',
      status: 'COMPLETED',
      plannedStartAt: '2026-08-16T14:00:00.000Z',
      plannedEndAt: '2026-08-16T22:00:00.000Z',
      actualStartAt: '2026-08-16T14:05:00.000Z',
    }),
  ],
  productLots: [
    buildLot({
      id: 'lot-1',
      expectedQuantityTonnes: '1000.250',
      doorAssignments: [
        buildDoorPeriod({
          id: 'period-north',
          warehouseDoor: { id: 'door-north', name: 'Porte Nord', status: 'AVAILABLE' },
        }),
      ],
    }),
    buildLot({
      id: 'lot-2',
      productName: 'Orge',
      customer: { id: 'customer-ceres', name: 'Cérès Agro', status: 'AVAILABLE' },
      expectedQuantityTonnes: '510.500',
      doorAssignments: [
        buildDoorPeriod({
          id: 'period-main',
          warehouseDoor: { id: 'door-main', name: 'Porte Principale', status: 'AVAILABLE' },
        }),
      ],
    }),
  ],
  truckPool: [
    buildPoolEntry({
      id: 'pool-1',
      truckId: 'truck-1',
      releasedAt: '2026-08-16T22:00:00.000Z',
    }),
    buildPoolEntry({
      id: 'pool-2',
      truckId: 'truck-2',
      registration: 'EF-456-GH',
      releasedAt: '2026-08-16T21:00:00.000Z',
    }),
  ],
})

async function header() {
  const heading = await screen.findByRole('heading', { level: 1, name: 'MV Loire Star' })

  return heading.parentElement?.nextElementSibling as HTMLElement
}

function field(container: HTMLElement, label: string) {
  const term = within(container).getByText(label, { selector: 'dt' })

  return term.nextElementSibling as HTMLElement
}

test.each(['overview', 'product-lots', 'truck-pool', 'shifts'] as const)(
  'heads the %s tab with the dock, the period, the IMO and the expected tonnage',
  async (tab) => {
    mockDischargeDetail({ details: [CLOSED] })

    renderDischargeTab(CLOSED.id, tab)

    const heading = await screen.findByRole('heading', { level: 1, name: 'MV Loire Star' })
    expect(heading.parentElement).toHaveTextContent('Closed')
    const facts = await header()
    expect(
      within(facts)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Dock', 'Period', 'IMO', 'Expected tonnage'])
    expect(field(facts, 'Dock')).toHaveTextContent(CLOSED.dock.name)
    expect(field(facts, 'IMO')).toHaveTextContent(CLOSED.vesselImo)
    expect(field(facts, 'Expected tonnage')).toHaveTextContent('1,510.750 t')
  },
)

test('reads the period from the start to a closure time not recorded yet', async () => {
  mockDischargeDetail({ details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  expect(field(await header(), 'Period')).toHaveTextContent(
    `${formatDateTime('2026-08-16T06:00:00.000Z')} → Not recorded`,
  )
})

test('says neither end of the period is recorded when the discharge never recorded a start', async () => {
  const unstarted = buildDischargeDetail(LOIRE_STAR, {
    startedAt: null,
    shifts: [buildShift({ status: 'COMPLETED', actualStartAt: null })],
  })
  mockDischargeDetail({ details: [unstarted] })

  renderDischargeDetail(unstarted.id)

  expect(field(await header(), 'Period')).toHaveTextContent('Not recorded → Not recorded')
})

test('offers no action on the discharge, even to a preparer', async () => {
  mockDischargeDetail({ user: ACTIVE_OPERATIONS_LEAD, details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  await header()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Start/ })).not.toBeInTheDocument()
})

test('shows the vessel comment on the overview only', async () => {
  const user = userEvent.setup()
  mockDischargeDetail({ details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  expect(await screen.findByText('Draught restricted at low tide')).toBeInTheDocument()
  expect(screen.getByText('Vessel comment')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /Product lots/ }))
  await screen.findByRole('region', { name: 'Product lots' })
  expect(screen.queryByText('Draught restricted at low tide')).not.toBeInTheDocument()
  expect(screen.queryByText('Vessel comment')).not.toBeInTheDocument()
})

test('says nothing of a vessel comment the discharge does not have', async () => {
  const silent = buildDischargeDetail(LOIRE_STAR, { vesselComment: null })
  mockDischargeDetail({ details: [silent] })

  renderDischargeDetail(silent.id)

  await header()
  expect(screen.queryByText('Vessel comment')).not.toBeInTheDocument()
})

test('opens on a frozen dock timeline, then a summary, instead of the details and preparation cards', async () => {
  mockDischargeDetail({ details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  const timeline = await screen.findByRole('region', {
    name: `Dock timeline · ${CLOSED.dock.name}`,
  })
  const summary = screen.getByRole('region', { name: 'Summary' })
  expect(timeline.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Preparation' })).not.toBeInTheDocument()
})

test('lays the shifts on the timeline from where the discharge started, with no now', async () => {
  mockDischargeDetail({ details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  const timeline = await screen.findByRole('region', {
    name: `Dock timeline · ${CLOSED.dock.name}`,
  })
  expect(
    within(within(timeline).getByRole('list', { name: 'Shifts on the timeline' })).getAllByRole(
      'listitem',
    ),
  ).toHaveLength(2)
  expect(within(timeline).getByText('Started')).toBeInTheDocument()
  expect(within(timeline).queryByText(/^Now/)).not.toBeInTheDocument()
  expect(within(timeline).queryByText(/Expected start/)).not.toBeInTheDocument()
})

test('sums up the shifts, the lots, and the trucks, each a way into its section', async () => {
  const user = userEvent.setup()
  mockDischargeDetail({ details: [CLOSED] })

  renderDischargeDetail(CLOSED.id)

  const summary = await screen.findByRole('region', { name: 'Summary' })
  expect(summary).toHaveTextContent('Closed discharges are read-only')
  expect(summary).toHaveTextContent('2 shifts')
  expect(summary).toHaveTextContent('2 lots · 2 customers · 1,510.750 t')
  expect(summary).toHaveTextContent('Unloaded through Porte Nord and Porte Principale')
  expect(summary).toHaveTextContent('2 trucks')
  expect(summary).toHaveTextContent(`All released on ${formatDateTime('2026-08-16T22:00:00.000Z')}`)

  await user.click(within(summary).getByRole('link', { name: 'Product lots' }))
  expect(await screen.findByRole('region', { name: 'Product lots' })).toBeInTheDocument()
})

test('draws no timeline for a discharge without shifts, and counts none', async () => {
  const empty = buildDischargeDetail(LOIRE_STAR, { shifts: [] })
  mockDischargeDetail({ details: [empty] })

  renderDischargeDetail(empty.id)

  const summary = await screen.findByRole('region', { name: 'Summary' })
  expect(summary).toHaveTextContent('0 shifts')
  expect(screen.queryByRole('region', { name: /Dock timeline/ })).not.toBeInTheDocument()
})
