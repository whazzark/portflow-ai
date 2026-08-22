import { fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { ACTIVE_USER, ADMIN_USER, TRANSPORT_COMPANIES } from '../support/fixtures'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

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
