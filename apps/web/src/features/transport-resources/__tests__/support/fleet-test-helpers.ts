import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'

import type { SessionUser } from '@/features/auth/context/session-context'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { ACTIVE_OPERATIONS_ADMIN, API_BASE_URL } from '@/features/trucks/__tests__/support/fixtures'
import type { TruckDto } from '@/features/trucks/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { FLEET_COMPANIES, FLEET_TRUCKS, withoutActors } from './fleet-fixtures'

export { API_BASE_URL }

type FleetState = {
  companies: TransportCompanyDto[]
  trucks: TruckDto[]
}

type MockFleetOptions = Partial<FleetState> & {
  user?: SessionUser
  onCompleteTrucksRequest?: () => void
}

/**
 * Serves the transport-resources reads from one mutable state, so a test that answers a write
 * updates `fleet.trucks` / `fleet.companies` and the following refetch returns the new truth.
 */
export function mockFleet({
  user = ACTIVE_OPERATIONS_ADMIN,
  companies = FLEET_COMPANIES,
  trucks = FLEET_TRUCKS,
  onCompleteTrucksRequest,
}: MockFleetOptions = {}) {
  const fleet: FleetState = { companies: [...companies], trucks: [...trucks] }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: fleet.companies }),
    ),
    http.get(`${API_BASE_URL}/api/v1/transport-companies/available`, () =>
      HttpResponse.json({
        data: fleet.companies.filter((company) => company.status === 'AVAILABLE'),
      }),
    ),
    http.get(`${API_BASE_URL}/api/v1/trucks`, () => {
      onCompleteTrucksRequest?.()
      return HttpResponse.json({ data: fleet.trucks })
    }),
    http.get(`${API_BASE_URL}/api/v1/trucks/available`, () =>
      HttpResponse.json({
        data: withoutActors(fleet.trucks.filter((truck) => truck.status === 'AVAILABLE')),
      }),
    ),
    http.get(`${API_BASE_URL}/api/v1/trucks/suspended`, () =>
      HttpResponse.json({
        data: withoutActors(fleet.trucks.filter((truck) => truck.status === 'SUSPENDED')),
      }),
    ),
  )

  return fleet
}

export function renderFleet(initialPath = '/transport-resources') {
  return renderApp(initialPath)
}

export function fleetTable() {
  return screen.getByRole('table', { name: 'Trucks by transport company' })
}

/** The first render goes through the route loader and the session read, which takes a while. */
export function findFleetTable() {
  return screen.findByRole('table', { name: 'Trucks by transport company' }, { timeout: 10000 })
}

/** The group header row of a company, found by its collapse/expand toggle. */
export function groupHeader(companyName: string) {
  const toggle = within(fleetTable()).getByRole('button', {
    name: new RegExp(`^(Collapse|Expand) ${companyName}$`),
  })
  const row = toggle.closest('tr')

  if (!row) {
    throw new Error(`No group header row for ${companyName}`)
  }

  return row
}

export function queryGroupHeader(companyName: string) {
  return within(fleetTable()).queryByRole('button', {
    name: new RegExp(`^(Collapse|Expand) ${companyName}$`),
  })
}

/** The row of a truck, found by its registration cell. */
export function truckRow(registration: string) {
  const cell = within(fleetTable()).getByRole('button', { name: `View truck ${registration}` })
  const row = cell.closest('tr')

  if (!row) {
    throw new Error(`No row for ${registration}`)
  }

  return row
}

export function queryTruckRow(registration: string) {
  return within(fleetTable()).queryByRole('button', { name: `View truck ${registration}` })
}

export function statusPill(name: 'Available' | 'Suspended' | 'Archived') {
  const group = screen.getByRole('group', { name: 'Filter by truck status' })

  return within(group).getByRole('button', { name: new RegExp(`^${name}\\b`) })
}

/** Registrations in display order, to assert grouping and sorting. */
export function listedRegistrations() {
  return within(fleetTable())
    .queryAllByRole('button', { name: /^View truck / })
    .map((button) => (button.getAttribute('aria-label') ?? '').replace('View truck ', ''))
}

/** Waits for the listed registrations: filters and search go through a navigation first. */
export function expectListed(registrations: string[]) {
  return waitFor(() => {
    if (JSON.stringify(listedRegistrations()) !== JSON.stringify(registrations)) {
      throw new Error(`Listed ${JSON.stringify(listedRegistrations())}`)
    }
  })
}

/** A `/transport-resources` address, encoded the way the router writes its search. */
export function fleetPath(search: Record<string, unknown>) {
  const params = new URLSearchParams(
    Object.entries(search).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  )

  return `/transport-resources?${params}`
}
