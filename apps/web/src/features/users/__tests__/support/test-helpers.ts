import { HttpResponse, http } from 'msw'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL, ORGANIZATION_ADMIN, USERS } from './fixtures'

export function mockUsers(viewer: unknown = ORGANIZATION_ADMIN, users: unknown[] = USERS) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: users })),
  )
}

/**
 * The API refuses the collection to this viewer. The workbench must render its failure state, never
 * an empty collection.
 */
export function mockUsersRefused(viewer: unknown, status = 403) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json(
        { error: { code: 'E_AUTHORIZATION_FAILURE', message: 'Access denied' } },
        { status },
      ),
    ),
  )
}

export function renderUsers(initialPath = '/users') {
  return renderApp(initialPath)
}
