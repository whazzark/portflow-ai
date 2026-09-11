import { screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import type { DischargeDetailDto } from '@/features/discharges/types'
import { formatDateTime } from '@/helpers/dates'
import { buildDischargeDetail, buildPoolEntry, listedDischarge } from '../support/fixtures'
import { mockDischargeDetail, renderDischargeDetail } from '../support/test-helpers'

const OCEAN_CEDAR = listedDischarge('MV Ocean Cedar', 'ACTIVE')

function renderPool(overrides: Partial<DischargeDetailDto>) {
  mockDischargeDetail({ details: [buildDischargeDetail(OCEAN_CEDAR, overrides)] })
  renderDischargeDetail(OCEAN_CEDAR.id)

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
