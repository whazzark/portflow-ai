import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import {
  mockTransportCompanies,
  mockTransportCompanyArchivalFailure,
  renderTransportCompanies,
} from '../support/test-helpers'

async function openDetailsFor(companyName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${companyName}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'View' }))
}

test('offers no edit affordance to a non-administrator', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  renderTransportCompanies()
  const companies = await screen.findByRole('list', { name: 'Available transport companies' })
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Atlantic Transport' }))

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
  expect(companies).toBeInTheDocument()
})

test('does not open the edit form for a non-administrator requesting companyDetailsMode=edit directly', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  renderTransportCompanies(
    `/transport-resources?companyDetailsId=${TRANSPORT_COMPANIES[0].id}&companyDetailsMode=edit`,
  )

  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit transport company' })).not.toBeInTheDocument()
})

test('offers no edit affordance to an administrator viewing an archived company', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  const companyTabs = screen.getByRole('tablist', { name: 'Transport company status' })
  fireEvent.click(within(companyTabs).getByRole('tab', { name: /^Archived/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Coastal Haulage' }))

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
})

test('does not open the edit form for an archived company requesting companyDetailsMode=edit directly', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies(
    `/transport-resources?companyStatus=archived&companyDetailsId=${TRANSPORT_COMPANIES[2].id}&companyDetailsMode=edit`,
  )

  expect(await screen.findByRole('heading', { name: 'Coastal Haulage' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit transport company' })).not.toBeInTheDocument()
})

test('offers no creation affordance to a non-administrator', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.queryByRole('button', { name: 'Create transport company' })).not.toBeInTheDocument()
})

test('offers no creation affordance in the empty state to a non-administrator', async () => {
  mockTrucks()
  mockTransportCompanies([], ACTIVE_USER)

  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()

  expect(
    screen.queryByRole('button', { name: 'Create a transport company' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create transport company' })).not.toBeInTheDocument()
})

test('does not open the create form for a non-administrator requesting companyDetailsMode=create directly', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  // biome-ignore lint/security/noSecrets: route search string, not a secret
  renderTransportCompanies('/transport-resources?companyDetailsMode=create')

  await screen.findByRole('list', { name: 'Available transport companies' })
  expect(
    screen.queryByRole('heading', { name: 'Create transport company' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('offers both creation affordances to an administrator', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  expect(screen.getByRole('button', { name: 'Create transport company' })).toBeInTheDocument()
})

test('offers the empty-state creation affordance to an administrator', async () => {
  mockTrucks()
  mockTransportCompanies([], ADMIN_USER)

  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()

  expect(screen.getByRole('button', { name: 'Create a transport company' })).toBeInTheDocument()
})

test('offers no archive affordance to a non-administrator', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ACTIVE_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')

  expect(await screen.findByRole('heading', { name: 'Atlantic Transport' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive company' })).not.toBeInTheDocument()
})

test('offers no archive affordance to an administrator viewing an archived company', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  const companyTabs = screen.getByRole('tablist', { name: 'Transport company status' })
  fireEvent.click(within(companyTabs).getByRole('tab', { name: /^Archived/ }))
  await screen.findByRole('list', { name: 'Archived transport companies' })
  await openDetailsFor('Coastal Haulage')

  expect(await screen.findByRole('heading', { name: 'Coastal Haulage' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive company' })).not.toBeInTheDocument()
})

test('surfaces an already-archived refusal distinctly and allows retrying without reopening', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  mockTransportCompanyArchivalFailure(409, {
    code: 'E_TRANSPORT_COMPANY_ALREADY_ARCHIVED',
    message: 'Transport company is already archived',
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(await screen.findByText('Transport company is already archived')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
})

test('surfaces a retryable save failure distinctly and allows retrying without reopening', async () => {
  mockTrucks()
  mockTransportCompanies(TRANSPORT_COMPANIES, ADMIN_USER)
  const state = mockTransportCompanyArchivalFailure(503, {
    code: 'E_SERVICE_UNAVAILABLE',
    message: 'The service is temporarily unavailable. Please try again.',
  })

  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })
  await openDetailsFor('Atlantic Transport')
  fireEvent.click(await screen.findByRole('button', { name: 'Archive company' }))
  await screen.findByRole('alertdialog')
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

  expect(
    await screen.findByText('The service is temporarily unavailable. Please try again.'),
  ).toBeInTheDocument()
  expect(state.attempts).toBe(1)

  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  await waitFor(() => expect(state.attempts).toBe(2))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})
