import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { truckQueries } from '@/features/trucks/queries/truck-queries'
import { server } from '@/test/msw/server'
import type { TruckDto } from '../../types'
import { ACTIVE_OBSERVER, API_BASE_URL, AVAILABLE_TRUCKS } from '../support/fixtures'
import { renderTrucks } from '../support/test-helpers'

const recoveredTruck: TruckDto = {
  ...AVAILABLE_TRUCKS[0],
  id: '00000000-0000-4000-8000-000000000199',
  registration: 'ZZ-999-PF',
  transportCompanyId: '00000000-0000-4000-8000-000000000099',
}

test('retries an initial failure and renders the recovered authoritative collection', async () => {
  const user = userEvent.setup()
  let requests = 0
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_OBSERVER })),
    // A non-administrator also loads the suspended collection; it is not what these
    // specs exercise, so it answers empty.
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({
        data: [
          { id: recoveredTruck.transportCompanyId, name: 'Recovered Carrier', status: 'AVAILABLE' },
        ],
      }),
    ),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () => {
      requests += 1
      return requests === 1
        ? HttpResponse.json(
            { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
            { status: 503 },
          )
        : HttpResponse.json({ data: [recoveredTruck] })
    }),
  )

  renderTrucks()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load trucks')
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('ZZ-999-PF')).toBeInTheDocument()
  // The workspace lists the company in its own directory too, so scope to the truck list.
  const trucks = screen.getByRole('list', { name: 'Available trucks' })
  expect(within(trucks).getByText('Recovered Carrier')).toBeInTheDocument()
  expect(requests).toBeGreaterThanOrEqual(2)
})

test('retry replaces a failed stale snapshot and reconciles its selected identity', async () => {
  const user = userEvent.setup()
  let response: 'initial' | 'failure' | 'recovered' = 'initial'
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: ACTIVE_OBSERVER })),
    // A non-administrator also loads the suspended collection; it is not what these
    // specs exercise, so it answers empty.
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () => HttpResponse.json({ data: [] })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({
        data: [
          {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Atlantic Transport',
            status: 'AVAILABLE',
          },
          { id: recoveredTruck.transportCompanyId, name: 'Recovered Carrier', status: 'AVAILABLE' },
        ],
      }),
    ),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () => {
      if (response === 'failure') {
        return HttpResponse.json(
          { error: { code: 'E_UNAVAILABLE', message: 'Unavailable' } },
          { status: 503 },
        )
      }

      return HttpResponse.json({
        data: response === 'initial' ? AVAILABLE_TRUCKS : [recoveredTruck],
      })
    }),
  )

  const { router } = renderTrucks()
  await user.click(await screen.findByRole('button', { name: /AA-101-PF, Atlantic Transport/ }))
  expect(await screen.findByRole('dialog', { name: 'AA-101-PF' })).toBeInTheDocument()

  response = 'failure'
  await act(() =>
    router.options.context.queryClient.refetchQueries({
      queryKey: truckQueries.available().queryKey,
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load trucks')
  expect(screen.queryByText('AA-101-PF')).not.toBeInTheDocument()

  response = 'recovered'
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('ZZ-999-PF')).toBeInTheDocument()
  // The workspace lists the company in its own directory too, so scope to the truck list.
  const trucks = screen.getByRole('list', { name: 'Available trucks' })
  expect(within(trucks).getByText('Recovered Carrier')).toBeInTheDocument()
  await expect.poll(() => router.state.location.search).not.toHaveProperty('truckId')
})
