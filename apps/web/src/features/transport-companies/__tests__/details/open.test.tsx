import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('opens lifecycle details and clears the selection when the company is clicked again', async () => {
  mockTransportCompanies()

  const { router } = renderTransportCompanies()
  fireEvent.click(await screen.findByText('Bêta Logistique'))

  const details = await screen.findByRole('region', { name: 'Transport company details' })
  expect(within(details).getByText('Latest reactivation context')).toBeInTheDocument()
  expect(within(details).getByText('Contract renewed')).toBeInTheDocument()
  expect(within(details).getByText('Claire Martin')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/transport-resources')

  fireEvent.click(screen.getByRole('button', { name: /Bêta Logistique/ }))
  await expect.poll(() => router.state.location.search).not.toHaveProperty('transportCompanyId')
  expect(
    await screen.findByRole('heading', { name: 'All transport companies' }),
  ).toBeInTheDocument()
})

test('restores archived details from the URL and clears a stale identity', async () => {
  mockTransportCompanies()

  renderTransportCompanies(
    // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
    '/transport-resources?companyStatus=archived&transportCompanyId=00000000-0000-4000-8000-000000000003',
  )
  const details = await screen.findByRole('region', { name: 'Transport company details' })
  expect(within(details).getByText('Archive context')).toBeInTheDocument()
  expect(within(details).getByText('Provider no longer serves the site')).toBeInTheDocument()

  cleanup()
  // biome-ignore lint/security/noSecrets: URL state fixture, not a secret
  const stale = renderTransportCompanies('/transport-resources?transportCompanyId=missing')
  await screen.findByRole('list', { name: 'Available transport companies' })
  await expect
    .poll(() => stale.router.state.location.search)
    .not.toHaveProperty('transportCompanyId')
})

test('redirects the legacy company URL and preserves consultation state', async () => {
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
