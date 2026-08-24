import { HttpResponse, http } from 'msw'

import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ACTIVE_USER, API_BASE_URL, createdTransportCompany, TRANSPORT_COMPANIES } from './fixtures'

export function mockTransportCompanies(companies = TRANSPORT_COMPANIES, user = ACTIVE_USER) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: companies }),
    ),
  )
}

/**
 * Intercepts creation against a mutable collection so a test can assert that the new company
 * really reaches the directory through the invalidated consultation query, rather than only
 * asserting that the request was sent.
 */
export function mockTransportCompanyCreation(initial: TransportCompanyDto[] = TRANSPORT_COMPANIES) {
  const state = { companies: [...initial], attempts: 0 }

  server.use(
    http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
      HttpResponse.json({ data: state.companies }),
    ),
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, async ({ request }) => {
      const body = (await request.json()) as { name: string }
      state.attempts += 1
      const created = createdTransportCompany(body.name.trim(), `created-${state.attempts}`)
      state.companies = [...state.companies, created]

      return HttpResponse.json({ data: created }, { status: 201 })
    }),
  )

  return state
}

export function mockTransportCompanyCreationFailure(
  status: number,
  error: { code: string; message: string; details?: { field: string; message: string }[] },
) {
  const state = { attempts: 0 }

  server.use(
    http.post(`${API_BASE_URL}/api/v1/transport-companies`, () => {
      state.attempts += 1

      return HttpResponse.json({ error }, { status })
    }),
  )

  return state
}

export function renderTransportCompanies(initialPath = '/transport-resources') {
  return renderApp(initialPath)
}
