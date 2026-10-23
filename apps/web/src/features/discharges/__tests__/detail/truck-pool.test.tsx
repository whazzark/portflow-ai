import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildPoolEntry,
  buildShift,
  listedDischarge,
} from '../support/fixtures'
import { mockDischargeDetail, renderDischargeTab } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')
const ATLANTIC_DAWN = listedDischarge('MV Atlantic Dawn', 'PLANNED')

function renderPool(
  overrides: Partial<DischargeDetailDto>,
  {
    user = ACTIVE_OBSERVER,
    listed = OCEAN_CEDAR,
  }: { user?: SessionUser; listed?: typeof OCEAN_CEDAR } = {},
) {
  mockDischargeDetail({ user, details: [buildDischargeDetail(listed, overrides)] })
  renderDischargeTab(listed.id, 'truck-pool')

  return screen.findByRole('region', { name: 'Truck pool' })
}

function bodyRows(region: HTMLElement) {
  return within(within(region).getByRole('table', { name: 'Truck pool' }))
    .getAllByRole('row')
    .slice(1)
}

test('lists each reserved truck with the registration and company it was reserved with', async () => {
  const region = await renderPool({ truckPool: [buildPoolEntry()] })

  const [row] = bodyRows(region)
  expect(row).toHaveTextContent('AB-123-CD')
  expect(row).toHaveTextContent('Transports du Port')
  expect(row).toHaveTextContent(formatDateTime('2026-09-07T08:00:00.000Z'))
})

test('lists the trucks still held before the released ones, which say when they left', async () => {
  const region = await renderPool({
    truckPool: [
      buildPoolEntry({
        id: 'released',
        registration: 'AA-000-AA',
        releasedAt: '2026-09-09T18:00:00.000Z',
      }),
      buildPoolEntry({ id: 'held', registration: 'ZZ-999-ZZ' }),
    ],
  })

  const rows = bodyRows(region)
  expect(rows[0]).toHaveTextContent('ZZ-999-ZZ')
  expect(rows[0]).not.toHaveTextContent('Released')
  expect(rows[1]).toHaveTextContent('AA-000-AA')
  expect(rows[1]).toHaveTextContent(`Released ${formatDateTime('2026-09-09T18:00:00.000Z')}`)
})

test('marks suspended and archived trucks, and archived companies', async () => {
  const region = await renderPool({
    truckPool: [
      buildPoolEntry({ id: 'suspended', registration: 'SU-001-SP', truckStatus: 'SUSPENDED' }),
      buildPoolEntry({
        id: 'archived',
        registration: 'AR-002-CH',
        transportCompany: { id: 'company-old', name: 'Transports Anciens', status: 'ARCHIVED' },
        truckStatus: 'ARCHIVED',
      }),
    ],
  })

  const [suspended, archived] = bodyRows(region)
  expect(suspended).toHaveTextContent('Suspended')
  expect(within(archived).getAllByText('Archived')).toHaveLength(2)
})

test('says so when no truck has been reserved', async () => {
  const region = await renderPool({ truckPool: [] })

  expect(within(region).getByText('No trucks reserved')).toBeInTheDocument()
  expect(within(region).queryByRole('table')).not.toBeInTheDocument()
})

test('does not present a closed discharge as still holding a truck whose release was not recorded', async () => {
  const region = await renderPool({
    status: 'CLOSED',
    truckPool: [buildPoolEntry({ releasedAt: null })],
  })

  const [row] = bodyRows(region)
  expect(row).toHaveTextContent('Release not recorded')
  expect(row).toHaveClass('text-muted-foreground')
})

const SHARED = buildPoolEntry({
  id: 'shared',
  registration: 'SH-100-RD',
  otherHoldings: [
    { dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar', status: 'ACTIVE' },
    { dischargeId: 'discharge-loire', vesselName: 'MV Loire Star', status: 'PLANNED' },
  ],
})

test.each([
  ['an observer', ACTIVE_OBSERVER],
  ['an operations lead', ACTIVE_OPERATIONS_LEAD],
])('marks a held truck other discharges also hold, for %s', async (_role, user) => {
  const region = await renderPool({ truckPool: [SHARED] }, { user, listed: ATLANTIC_DAWN })

  const [row] = bodyRows(region)
  const marker = within(row).getByRole('button', {
    name: 'Also held by MV Ocean Cedar · Active, MV Loire Star · Planned',
  })
  expect(row).not.toHaveTextContent('MV Ocean Cedar')

  fireEvent.click(marker)
  const popover = await screen.findByRole('dialog', { name: 'Also held by' })
  expect(popover).toHaveTextContent('MV Ocean Cedar · Active')
  expect(popover).toHaveTextContent('MV Loire Star · Planned')
  expect(popover).toHaveTextContent(
    'Only one active discharge can hold a truck, so starting a discharge settles it.',
  )
})

test('closes the holdings popover on Escape and returns focus to its marker', async () => {
  const user = userEvent.setup()
  const region = await renderPool({ truckPool: [SHARED] }, { listed: ATLANTIC_DAWN })

  const marker = within(region).getByRole('button', { name: /^Also held by/ })
  await user.click(marker)
  expect(await screen.findByRole('dialog', { name: 'Also held by' })).toBeInTheDocument()

  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Also held by' })).not.toBeInTheDocument(),
  )
  expect(marker).toHaveFocus()
})

test('sums up the trucks held and the suspended ones above the table', async () => {
  const region = await renderPool(
    {
      truckPool: [
        buildPoolEntry({ id: 'a', truckId: 'a', registration: 'AA-100-AA' }),
        buildPoolEntry({
          id: 'b',
          truckId: 'b',
          registration: 'BB-200-BB',
          truckStatus: 'SUSPENDED',
        }),
        buildPoolEntry({ id: 'c', truckId: 'c', registration: 'CC-300-CC' }),
        buildPoolEntry({
          id: 'd',
          truckId: 'd',
          registration: 'DD-400-DD',
          releasedAt: '2026-09-09T18:00:00.000Z',
        }),
      ],
    },
    { listed: ATLANTIC_DAWN },
  )

  expect(region).toHaveTextContent('3 trucks reserved · 1 suspended')
})

test('says one truck is reserved, without a suspended count when none is', async () => {
  const region = await renderPool({ truckPool: [buildPoolEntry()] }, { listed: ATLANTIC_DAWN })

  expect(within(region).getByText('1 truck reserved')).toBeInTheDocument()
  expect(region).not.toHaveTextContent('suspended')
  expect(region).not.toHaveTextContent('Also held by planned discharges')
})

test.each([
  [
    'planned discharges',
    [{ dischargeId: 'discharge-loire', vesselName: 'MV Loire Star', status: 'PLANNED' as const }],
    'Also held by planned discharges: the first to start keeps the truck',
  ],
  [
    'an active discharge',
    [{ dischargeId: 'discharge-cedar', vesselName: 'MV Ocean Cedar', status: 'ACTIVE' as const }],
    'Also held by other discharges: a truck can serve only one active discharge',
  ],
])('warns above the table when %s also hold a truck', async (_case, otherHoldings, hint) => {
  const region = await renderPool(
    { truckPool: [buildPoolEntry({ otherHoldings })] },
    { listed: ATLANTIC_DAWN },
  )

  expect(within(region).getByText(hint)).toBeInTheDocument()
})

test('counts the planned shifts using each truck', async () => {
  const uses = (truckId: string) => ({
    id: `row-${truckId}`,
    truckId,
    registration: truckId,
    truckStatus: 'AVAILABLE' as const,
    effectiveFrom: '2026-09-07T08:00:00.000Z',
    effectiveTo: null,
  })
  const region = await renderPool(
    {
      truckPool: [
        buildPoolEntry({ id: 'busy', truckId: 'busy', registration: 'BU-100-SY' }),
        buildPoolEntry({ id: 'idle', truckId: 'idle', registration: 'ID-200-LE' }),
        buildPoolEntry({
          id: 'gone',
          truckId: 'gone',
          registration: 'GO-300-NE',
          releasedAt: '2026-09-09T18:00:00.000Z',
        }),
      ],
      shifts: [
        buildShift({ id: 'one', trucks: [uses('busy')] }),
        buildShift({ id: 'two', trucks: [uses('busy')] }),
      ],
    },
    { listed: ATLANTIC_DAWN },
  )

  const table = within(region).getByRole('table', { name: 'Truck pool' })
  const headers = within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
  expect(headers).toEqual(['Registration', 'Transport company', 'Shifts', 'Reserved', 'Released'])
  const shiftsCell = (row: HTMLElement) => within(row).getAllByRole('cell')[2]
  const [busy, idle, gone] = bodyRows(region)
  expect(shiftsCell(busy)).toHaveTextContent(/^2$/)
  expect(shiftsCell(idle)).toHaveTextContent(/^0$/)
  expect(shiftsCell(gone)).toHaveTextContent(/^—$/)
})

test.each([
  ['an observer on a planned discharge', ACTIVE_OBSERVER, ATLANTIC_DAWN],
  ['an operations lead on an active discharge', ACTIVE_OPERATIONS_LEAD, OCEAN_CEDAR],
])('offers no truck planning to %s', async (_case, user, listed) => {
  const region = await renderPool({ truckPool: [buildPoolEntry()] }, { user, listed })

  expect(within(region).queryByRole('button', { name: 'Add trucks' })).not.toBeInTheDocument()
  expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Withdraw/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('toolbar', { name: 'Selected trucks' })).not.toBeInTheDocument()
})

test('offers a preparer to add trucks on a planned discharge, also from the empty pool', async () => {
  const region = await renderPool(
    { truckPool: [] },
    { user: ACTIVE_OPERATIONS_LEAD, listed: ATLANTIC_DAWN },
  )

  expect(within(region).getAllByRole('button', { name: 'Add trucks' })).toHaveLength(2)
  expect(within(region).getByText('No trucks reserved')).toBeInTheDocument()
})

test('forgets the selection when the user leaves the truck pool tab', async () => {
  const user = userEvent.setup()
  const region = await renderPool(
    { truckPool: [buildPoolEntry()] },
    { user: ACTIVE_OPERATIONS_LEAD, listed: ATLANTIC_DAWN },
  )

  fireEvent.click(within(region).getByRole('checkbox', { name: 'Select all trucks' }))
  expect(screen.getByRole('toolbar', { name: 'Selected trucks' })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Overview' }))
  await user.click(screen.getByRole('tab', { name: /^Truck pool/ }))

  const reopened = await screen.findByRole('region', { name: 'Truck pool' })
  await waitFor(() =>
    expect(within(reopened).getByRole('checkbox', { name: 'Select AB-123-CD' })).not.toBeChecked(),
  )
  expect(screen.queryByRole('toolbar', { name: 'Selected trucks' })).not.toBeInTheDocument()
})
