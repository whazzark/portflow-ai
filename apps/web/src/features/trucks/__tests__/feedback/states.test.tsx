import { act, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { server } from '@/test/msw/server'
import { ACTIVE_OBSERVER, API_BASE_URL, AVAILABLE_TRUCKS } from '../support/fixtures'
import { mockTrucks, renderTrucks } from '../support/test-helpers'

test('distinguishes loading, lifecycle-empty, and search-no-match feedback', async () => {
  let releaseTrucks!: () => void
  const pendingTrucks = new Promise<void>((resolve) => {
    releaseTrucks = resolve
  })

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_OBSERVER })),
    // A non-administrator also loads the suspended collection; it is not what these
    // specs exercise, so it answers empty.
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, async () => {
      await pendingTrucks
      return HttpResponse.json({ data: AVAILABLE_TRUCKS })
    }),
  )

  renderTrucks()
  expect(await screen.findByRole('status', { name: 'Loading trucks' })).toBeInTheDocument()
  releaseTrucks()
  expect(await screen.findByRole('list', { name: 'Available trucks' })).toBeInTheDocument()

  cleanup()
  mockTrucks({ available: [] })
  renderTrucks()
  expect(await screen.findByText('No available trucks')).toBeInTheDocument()

  cleanup()
  const user = userEvent.setup()
  mockTrucks()
  renderTrucks()
  await screen.findByRole('list', { name: 'Available trucks' })
  await user.type(screen.getByRole('textbox', { name: 'Search trucks' }), 'missing')
  expect(await screen.findByText('No matching trucks')).toBeInTheDocument()
})

test('shows initial and refresh failures instead of stale truck data', async () => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_OBSERVER })),
    // A non-administrator also loads the suspended collection; it is not what these
    // specs exercise, so it answers empty.
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json(
        { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
        { status: 503 },
      ),
    ),
  )

  renderTrucks()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load trucks')

  cleanup()
  let shouldFail = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_OBSERVER })),
    // A non-administrator also loads the suspended collection; it is not what these
    // specs exercise, so it answers empty.
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      shouldFail
        ? HttpResponse.json(
            { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
            { status: 503 },
          )
        : HttpResponse.json({ data: AVAILABLE_TRUCKS }),
    ),
  )

  const { router } = renderTrucks()
  expect(await screen.findByText('AA-101-PF')).toBeInTheDocument()
  shouldFail = true
  await act(() =>
    router.options.context.queryClient.refetchQueries({
      queryKey: truckQueries.available().queryKey,
    }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load trucks')
  expect(screen.queryByText('AA-101-PF')).not.toBeInTheDocument()
})
