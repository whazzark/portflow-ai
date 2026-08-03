import { HttpResponse, http } from 'msw'

import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL, TRANSPORT_COMPANIES } from './fixtures'

export function mockTransportCompanies(companies = TRANSPORT_COMPANIES, user = ACTIVE_USER) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: companies }),
    ),
  )
}

export function renderTransportCompanies(initialPath = '/transport-resources') {
  const path =
    initialPath === '/transport-resources' ? '/transport-resources?resource=companies' : initialPath
  return renderApp(path)
}
