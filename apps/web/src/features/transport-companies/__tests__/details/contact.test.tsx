import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

async function openDetailsFor(companyName: string) {
  const user = userEvent.setup()
  const companies = await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(within(companies).getByRole('button', { name: `Actions for ${companyName}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))

  return screen.findByRole('region', { name: 'Transport company details' })
}

test('shows a migrated company recorded phone number and email address', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)
  renderTransportCompanies()

  const details = await openDetailsFor('Atlantic Transport')

  expect(within(details).getByText('+33 2 40 12 34 56')).toBeInTheDocument()
  expect(within(details).getByText('dispatch@atlantic-transport.test')).toBeInTheDocument()
})

test('states explicitly that no contact details are recorded for a company registered before this feature', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)
  renderTransportCompanies()

  const details = await openDetailsFor('Nordic Haulers')

  expect(within(details).getByText('No contact details recorded')).toBeInTheDocument()
  expect(within(details).queryByText('+33')).not.toBeInTheDocument()
})

test('keeps an archived company recorded contact details visible and read-only', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)
  renderTransportCompanies()

  const user = userEvent.setup()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(screen.getByRole('tab', { name: /Archived/ }))
  const archivedList = await screen.findByRole('list', { name: 'Archived transport companies' })
  await user.click(
    within(archivedList).getByRole('button', { name: 'Actions for Coastal Haulage' }),
  )
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))

  const details = await screen.findByRole('region', { name: 'Transport company details' })
  expect(within(details).getByText('+44 20 7946 0958')).toBeInTheDocument()
  expect(within(details).getByText('ops@coastal-haulage.test')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})

test('offers no edit affordance to an active user without administration rights', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)
  renderTransportCompanies()

  const details = await openDetailsFor('Atlantic Transport')

  expect(within(details).getByText('+33 2 40 12 34 56')).toBeInTheDocument()
  expect(within(details).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
})
