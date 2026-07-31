import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'
import { ACTIVE_USER, API_BASE_URL, TRANSPORT_COMPANIES } from '../support/fixtures'
import { mockTransportCompanies, renderTransportCompanies } from '../support/test-helpers'

test('distinguishes loading, lifecycle-empty, and search-no-match feedback', async () => {
  let releaseCompanies!: () => void
  const pendingCompanies = new Promise<void>((resolve) => {
    releaseCompanies = resolve
  })

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, async () => {
      await pendingCompanies
      return HttpResponse.json({ data: TRANSPORT_COMPANIES })
    }),
  )

  renderTransportCompanies()
  expect(
    await screen.findByRole('main', { name: 'Loading transport companies' }, { timeout: 5000 }),
  ).toBeInTheDocument()
  releaseCompanies()
  expect(
    await screen.findByRole('list', { name: 'Available transport companies' }),
  ).toBeInTheDocument()

  cleanup()
  mockTransportCompanies([])
  renderTransportCompanies()
  expect(await screen.findByText('No available transport companies')).toBeInTheDocument()
})

test('shows no-match feedback for a non-empty lifecycle', async () => {
  const user = userEvent.setup()
  mockTransportCompanies()
  renderTransportCompanies()
  await screen.findByRole('list', { name: 'Available transport companies' })

  await user.type(screen.getByRole('textbox', { name: 'Search transport companies' }), 'missing')
  expect(await screen.findByText('No matching transport companies')).toBeInTheDocument()
})
