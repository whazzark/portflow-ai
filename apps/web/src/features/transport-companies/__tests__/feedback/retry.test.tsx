import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { server } from '@/test/msw/server'
import { ACTIVE_USER, API_BASE_URL, TRANSPORT_COMPANIES } from '../support/fixtures'
import { renderTransportCompanies } from '../support/test-helpers'

test('retries a failed request and replaces it with the recovered authoritative collection', async () => {
  const user = userEvent.setup()
  let requests = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json(
            { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
            { status: 503 },
          )
        : HttpResponse.json({ data: TRANSPORT_COMPANIES })
    }),
  )

  renderTransportCompanies()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load transport companies')
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Atlantic Transport')).toBeInTheDocument()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('surfaces a failed refresh instead of silently keeping stale companies', async () => {
  const user = userEvent.setup()
  let shouldFail = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      shouldFail
        ? HttpResponse.json(
            { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
            { status: 503 },
          )
        : HttpResponse.json({ data: TRANSPORT_COMPANIES }),
    ),
  )

  const { router } = renderTransportCompanies()
  expect(await screen.findByText('Atlantic Transport')).toBeInTheDocument()

  shouldFail = true
  await act(() =>
    router.options.context.queryClient.refetchQueries({
      queryKey: transportCompanyQueries.all().queryKey,
    }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load transport companies')
  expect(screen.queryByText('Atlantic Transport')).not.toBeInTheDocument()

  shouldFail = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Atlantic Transport')).toBeInTheDocument()
})
