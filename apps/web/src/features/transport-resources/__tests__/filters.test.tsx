import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  expectListed,
  findFleetTable,
  fleetPath,
  fleetTable,
  groupHeader,
  listedRegistrations,
  mockFleet,
  queryGroupHeader,
  renderFleet,
  statusPill,
} from './support/fleet-test-helpers'

test('lists only suspended trucks, under the companies that have one', async () => {
  const user = userEvent.setup()
  mockFleet()
  const { router } = renderFleet()
  await findFleetTable()

  await user.click(statusPill('Available'))

  await expectListed(['NP-901-QR', 'GH-012-JK'])
  expect(statusPill('Available')).toHaveAttribute('aria-pressed', 'false')
  expect(queryGroupHeader('Bretagne Vrac')).not.toBeInTheDocument()
  await expect.poll(() => router.state.location.search).toMatchObject({ status: ['suspended'] })
})

test('keeps at least one status selected', async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet(fleetPath({ status: ['suspended'] }))
  await findFleetTable()

  await user.click(statusPill('Suspended'))

  expect(statusPill('Suspended')).toHaveAttribute('aria-pressed', 'true')
  expect(listedRegistrations()).toEqual(['NP-901-QR', 'GH-012-JK'])
})

test('lists archived companies and trucks with their archive context', async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()

  await user.click(statusPill('Archived'))
  await user.click(statusPill('Available'))
  await user.click(statusPill('Suspended'))

  await expectListed(['QR-234-ST'])
  const morvan = within(groupHeader('Transports Morvan'))
  expect(morvan.getByText('Archived')).toBeInTheDocument()
  expect(morvan.getByText('“Company closed its bulk activity”')).toBeInTheDocument()
  expect(morvan.getByText('Thomas Bernard, 02/07/2026', { exact: false })).toBeInTheDocument()
  expect(
    screen.getByText('Reactivate the company first to reactivate one of its trucks.'),
  ).toBeInTheDocument()
})

test('shows a single company and says how many others it hides', async () => {
  const user = userEvent.setup()
  mockFleet()
  const { router } = renderFleet()
  await findFleetTable()

  await user.click(within(fleetTable()).getByRole('button', { name: 'Show only Loire Logistique' }))

  expect(await screen.findByText('Showing', { exact: false })).toHaveTextContent(
    'Showing Loire Logistique',
  )
  expect(screen.getByText('2 other companies hidden')).toBeInTheDocument()
  expect(listedRegistrations()).toEqual(['EF-789-GH', 'GH-012-JK'])
  await expect
    .poll(() => router.state.location.search)
    .toHaveProperty('transportCompanyId', groupHeaderCompanyId('Loire Logistique'))

  await user.click(screen.getByRole('button', { name: 'Show all companies' }))

  await waitFor(() =>
    expect(screen.queryByText('2 other companies hidden')).not.toBeInTheDocument(),
  )
  expect(listedRegistrations()).toHaveLength(7)
})

test('searches registrations, vehicle models and company names', { timeout: 20000 }, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()
  const search = screen.getByRole('textbox', { name: 'Search transport resources' })

  await user.type(search, 'ef-789')
  await expectListed(['EF-789-GH'])

  await user.clear(search)
  await user.type(search, 'scania')
  await expectListed(['CD-456-EF', 'NP-901-QR'])

  await user.clear(search)
  await user.type(search, 'bretagne')
  await expectListed(['JK-345-LM', 'LM-678-NP'])
})

test('explains a search that matches nothing and offers ways out', { timeout: 20000 }, async () => {
  const user = userEvent.setup()
  mockFleet()
  renderFleet()
  await findFleetTable()
  const search = screen.getByRole('textbox', { name: 'Search transport resources' })

  await user.type(search, 'QR-234')

  expect(await screen.findByText('No truck or company matches “QR-234”')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Search looks in registrations, vehicle models and company names, for the statuses selected above. Archived trucks are hidden.',
    ),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Include archived' }))

  await expectListed(['QR-234-ST'])
  expect(statusPill('Archived')).toHaveAttribute('aria-pressed', 'true')

  await user.clear(search)
  await user.type(search, 'ZZ-999')
  await screen.findByText('No truck or company matches “ZZ-999”')
  expect(screen.queryByRole('button', { name: 'Include archived' })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Clear search' }))

  await waitFor(() => expect(search).toHaveValue(''))
  await waitFor(() => expect(listedRegistrations()).toContain('QR-234-ST'))
})

test('restores a filtered and searched view from the address', async () => {
  mockFleet()
  renderFleet(fleetPath({ status: ['suspended'], search: 'man' }))
  await findFleetTable()

  expect(screen.getByRole('textbox', { name: 'Search transport resources' })).toHaveValue('man')
  expect(listedRegistrations()).toEqual(['GH-012-JK'])
})

test('opens a former Transport companies address on the equivalent view', async () => {
  mockFleet()
  const { router } = renderFleet(
    `/transport-companies?${new URLSearchParams({ status: 'archived', search: 'Morvan' })}`,
  )
  await findFleetTable()

  await expect.poll(() => router.state.location.pathname).toBe('/transport-resources')
  expect(statusPill('Archived')).toHaveAttribute('aria-pressed', 'true')
  expect(statusPill('Available')).toHaveAttribute('aria-pressed', 'false')
  expect(groupHeader('Transports Morvan')).toBeInTheDocument()
})

test('opens a former truck-status address on the equivalent view', async () => {
  mockFleet()
  renderFleet(fleetPath({ truckStatus: 'suspended' }))
  await findFleetTable()

  expect(listedRegistrations()).toEqual(['NP-901-QR', 'GH-012-JK'])
})

function groupHeaderCompanyId(name: string) {
  return groupHeader(name).getAttribute('data-company-id')
}
