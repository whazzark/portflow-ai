import { HttpResponse, http } from 'msw'
import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import { API_BASE_URL, DEACTIVATED_AT, ORGANIZATION_ADMIN, USERS } from './fixtures'

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

/**
 * A workbench whose collection actually changes when a deactivation succeeds: the write handler
 * rewrites the entry and the next read serves it. The tests then observe the same refresh the real
 * workbench performs, rather than a second payload staged by hand.
 */
export function mockUsersWithDeactivation(
  viewer: { id: string; firstName: string; lastName: string } = ORGANIZATION_ADMIN,
  users: UserDto[] = USERS,
) {
  let collection = users

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: collection })),
    http.post(`${API_BASE_URL}/api/v1/users/:id/deactivate`, ({ params }) => {
      const target = collection.find((user) => user.id === params.id)

      if (!target) {
        return HttpResponse.json(
          { error: { code: 'E_USER_NOT_FOUND', message: 'User not found' } },
          { status: 404 },
        )
      }

      const deactivated: UserDto = {
        ...target,
        accessStatus: 'DEACTIVATED',
        deactivatedAt: DEACTIVATED_AT,
        deactivatedBy: {
          id: viewer.id,
          firstName: viewer.firstName,
          lastName: viewer.lastName,
        },
      }

      collection = collection.map((user) => (user.id === deactivated.id ? deactivated : user))

      return HttpResponse.json({ data: deactivated })
    }),
  )
}

/** Registered after a collection mock, to override its write handler with one refusal. */
export function mockDeactivationRefused(code: string, message: string, status = 409) {
  server.use(
    http.post(`${API_BASE_URL}/api/v1/users/:id/deactivate`, () =>
      HttpResponse.json({ error: { code, message } }, { status }),
    ),
  )
}

/** The request never reaches the API: the retryable failure path. */
export function mockDeactivationUnreachable() {
  server.use(http.post(`${API_BASE_URL}/api/v1/users/:id/deactivate`, () => HttpResponse.error()))
}

export function renderUsers(initialPath = '/users') {
  return renderApp(initialPath)
}
