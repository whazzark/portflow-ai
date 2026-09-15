import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import {
  ACTIVE_OBSERVER,
  ACTIVE_OPERATIONS_LEAD,
  buildDischargeDetail,
  buildPoolEntry,
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

  fireEvent.focus(marker)
  const tooltip = await screen.findByText('Also held by')
  expect(tooltip.parentElement).toHaveTextContent('MV Ocean Cedar · Active')
  expect(tooltip.parentElement).toHaveTextContent('MV Loire Star · Planned')
})

test.each([
  ['an observer on a planned discharge', ACTIVE_OBSERVER, ATLANTIC_DAWN],
  ['an operations lead on an active discharge', ACTIVE_OPERATIONS_LEAD, OCEAN_CEDAR],
])('offers no truck planning to %s', async (_case, user, listed) => {
  const region = await renderPool({ truckPool: [buildPoolEntry()] }, { user, listed })

  expect(within(region).queryByRole('button', { name: 'Add trucks' })).not.toBeInTheDocument()
  expect(within(region).queryByRole('checkbox')).not.toBeInTheDocument()
  expect(within(region).queryByRole('button', { name: /^Withdraw/ })).not.toBeInTheDocument()
})

test('offers a preparer to add trucks on a planned discharge, also from the empty pool', async () => {
  const region = await renderPool(
    { truckPool: [] },
    { user: ACTIVE_OPERATIONS_LEAD, listed: ATLANTIC_DAWN },
  )

  expect(within(region).getAllByRole('button', { name: 'Add trucks' })).toHaveLength(2)
  expect(within(region).getByText('No trucks reserved')).toBeInTheDocument()
})
