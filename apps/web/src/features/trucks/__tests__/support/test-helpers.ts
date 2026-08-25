import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'

import type { SessionUser } from '@/features/auth/context/session-context'
import { TRANSPORT_COMPANIES } from '@/features/transport-companies/__tests__/support/fixtures'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_OBSERVER, API_BASE_URL, AVAILABLE_TRUCKS, TRUCKS } from './fixtures'

type MockTrucksOptions = {
  user?: SessionUser
  complete?: TruckDto[]
  available?: TruckDto[]
  companies?: Array<Pick<TransportCompanyDto, 'id' | 'name' | 'status'>>
  onCompleteRequest?: () => void
  onAvailableRequest?: () => void
}

export function mockTrucks({
  user = ACTIVE_OBSERVER,
  complete = TRUCKS,
  available = AVAILABLE_TRUCKS,
  companies = TRANSPORT_COMPANIES,
  onCompleteRequest,
  onAvailableRequest,
}: MockTrucksOptions = {}) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: companies }),
    ),
    http.get(`${API_BASE_URL}/api/v1/transport-companies/available`, () =>
      HttpResponse.json({
        data: companies.filter((company) => company.status === 'AVAILABLE'),
      }),
    ),
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => {
      onCompleteRequest?.()
      return HttpResponse.json({ data: complete })
    }),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () => {
      onAvailableRequest?.()
      return HttpResponse.json({ data: available })
    }),
  )
}

export function renderTrucks(initialPath = '/transport-resources') {
  return renderApp(initialPath)
}

/**
 * Scopes tab queries to the truck directory.
 *
 * Two things make an unscoped `getByRole('tab', ...)` wrong here. The transport-resources
 * workspace renders a transport-company tablist with the same Available/Archived labels, so the
 * query is ambiguous; and opening truck details opens a sheet, which marks the directory behind it
 * `aria-hidden`, so the tabs drop out of the default accessibility tree.
 */
const truckTablist = () =>
  within(screen.getByRole('tablist', { name: 'Truck status', hidden: true }))

export function truckTab(name: string | RegExp) {
  return truckTablist().getByRole('tab', { name, hidden: true })
}

export function queryTruckTab(name: string | RegExp) {
  return truckTablist().queryByRole('tab', { name, hidden: true })
}

export async function findTruckTab(name: string | RegExp) {
  const tablist = await screen.findByRole('tablist', { name: 'Truck status', hidden: true })

  return within(tablist).findByRole('tab', { name, hidden: true })
}
