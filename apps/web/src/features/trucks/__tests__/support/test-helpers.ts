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

export function renderTrucks(initialPath = '/transport-resources?resource=trucks') {
  return renderApp(initialPath)
}
