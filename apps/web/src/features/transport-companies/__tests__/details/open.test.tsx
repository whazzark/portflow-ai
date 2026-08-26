import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { mockTrucks } from '@/features/trucks/__tests__/support/test-helpers'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('opens lifecycle details and clears the selection when closed', async () => {
  const user = userEvent.setup()
  mockTrucks()
  mockTransportCompanies()

  const { router } = renderTransportCompanies()
  const companies = await screen.findByRole('list', { name: 'Available transport companies' })
  await user.click(within(companies).getByRole('button', { name: 'Actions for Bêta Logistique' }))
  await user.click(await screen.findByRole('menuitem', { name: 'View' }))

  const details = await screen.findByRole('region', { name: 'Transport company details' })
  expect(within(details).getByText('Reactivation context')).toBeInTheDocument()
  expect(within(details).getByText('Contract renewed')).toBeInTheDocument()
  expect(within(details).getByText('Claire Martin')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/transport-resources')

  await user.click(screen.getByRole('button', { name: 'Close' }))
  // biome-ignore lint/security/noSecrets: URL state property name, not a secret
  await expect.poll(() => router.state.location.search).not.toHaveProperty('companyDetailsId')
  expect(
    screen.queryByRole('region', { name: 'Transport company details' }),
  ).not.toBeInTheDocument()
})

test('restores archived details from the URL and clears a stale identity', async () => {
  mockTrucks()
  mockTransportCompanies()

  renderTransportCompanies(
    // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
    '/transport-resources?companyStatus=archived&companyDetailsId=00000000-0000-4000-8000-000000000003',
  )
  const details = await screen.findByRole('region', { name: 'Transport company details' })
  expect(within(details).getByText('Archive context')).toBeInTheDocument()
  expect(within(details).getByText('Provider no longer serves the site')).toBeInTheDocument()

  cleanup()
  mockTrucks()
  mockTransportCompanies()
  const stale = renderTransportCompanies(
    // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
    '/transport-resources?companyDetailsId=missing',
  )
  await screen.findByRole('list', { name: 'Available transport companies' })
  // biome-ignore lint/security/noSecrets: URL state property name, not a secret
  await expect.poll(() => stale.router.state.location.search).not.toHaveProperty('companyDetailsId')
})

test('redirects the legacy company URL and preserves consultation state', async () => {
  mockTrucks()
  mockTransportCompanies()

  const { router } = renderTransportCompanies(
    // biome-ignore lint/security/noSecrets: legacy URL state fixture, not a secret
    '/transport-companies?status=archived&search=coastal',
  )

  await screen.findByRole('list', { name: 'Archived transport companies' })
  await expect.poll(() => router.state.location.pathname).toBe('/transport-resources')
  expect(router.state.location.search).toMatchObject({
    companyStatus: 'archived',
    companySearch: 'coastal',
  })
})
