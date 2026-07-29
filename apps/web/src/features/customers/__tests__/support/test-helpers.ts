import { HttpResponse, http } from 'msw'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { ADMIN, API_BASE_URL, CUSTOMERS } from './fixtures'

export function mockCustomers(user = ADMIN, customers = CUSTOMERS) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: user })),
    http.get(`${API_BASE_URL}/api/v1/customers`, () => HttpResponse.json({ data: customers })),
  )
}

export function renderCustomers(initialPath = '/customers') {
  return renderApp(initialPath)
}
