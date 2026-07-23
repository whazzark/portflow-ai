import { screen } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { ADMIN, API_BASE_URL, CUSTOMERS } from '../support/fixtures'
import { renderCustomers } from '../support/test-helpers'

test('shows the TanStack Start pending page while the customer list loads', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/customers`, async () => {
      await delay(1500)
      return HttpResponse.json({ data: CUSTOMERS })
    }),
  )

  renderCustomers()

  expect(
    await screen.findByRole('main', { name: 'Loading customers' }, { timeout: 3000 }),
  ).toBeInTheDocument()
  expect(await screen.findByRole('table', { name: 'Available customers' })).toBeInTheDocument()
})

test('shows a retryable error component when the customer list fails', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ADMIN })),
    http.get(`${API_BASE_URL}/api/v1/customers`, () =>
      HttpResponse.json(
        { error: { code: 'E_CUSTOMERS_UNAVAILABLE', message: 'Unavailable' } },
        { status: 503 },
      ),
    ),
  )

  renderCustomers()

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load customers')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})
