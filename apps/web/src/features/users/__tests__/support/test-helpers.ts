import { HttpResponse, http } from 'msw'
import type { UserDto } from '@/features/users/types'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  API_BASE_URL,
  DEACTIVATED_AT,
  ORGANIZATION_ADMIN,
  RESPONSIBLE_ADMIN,
  USERS,
} from './fixtures'

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

/**
 * The race another administrator won: the write refuses because the user is already deactivated,
 * and the read that follows it says the same thing — they are gone from the active users. Stands on
 * its own, collection included, because the point is precisely that the two agree.
 */
export function mockDeactivationLostRace(
  targetId: string,
  viewer: { id: string; firstName: string; lastName: string } = ORGANIZATION_ADMIN,
  users: UserDto[] = USERS,
) {
  const movedOn: UserDto[] = users.map((user) =>
    user.id === targetId
      ? {
          ...user,
          accessStatus: 'DEACTIVATED',
          deactivatedAt: DEACTIVATED_AT,
          deactivatedBy: RESPONSIBLE_ADMIN,
        }
      : user,
  )
  let refused = false

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () =>
      HttpResponse.json({ data: refused ? movedOn : users }),
    ),
    http.post(`${API_BASE_URL}/api/v1/users/:id/deactivate`, () => {
      refused = true

      return HttpResponse.json(
        {
          error: {
            code: 'E_USER_ALREADY_DEACTIVATED',
            message: 'This user has already been deactivated',
          },
        },
        { status: 409 },
      )
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

/**
 * A collection that answers identity corrections the way the API does: the correction lands in the
 * collection, so the refetch the mutation triggers is what carries it back to the workbench — the
 * record being a view over that collection, exactly as in production.
 */
export function mockIdentityCorrection(
  viewer: unknown = ORGANIZATION_ADMIN,
  users: UserDto[] = USERS,
) {
  const collection = users.map((user) => ({ ...user }))
  const corrections: Array<{ id: string; body: unknown }> = []

  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: collection })),
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, async ({ params, request }) => {
      const body = (await request.json()) as Record<string, string>
      corrections.push({ id: String(params.id), body })

      const target = collection.find((user) => user.id === params.id)

      if (!target) {
        return HttpResponse.json(
          { error: { code: 'E_USER_NOT_FOUND', message: 'User not found' } },
          { status: 404 },
        )
      }

      Object.assign(target, body)

      return HttpResponse.json({ data: target })
    }),
  )

  return { collection, corrections }
}

/** The API refuses the correction. The panel must report it and keep what was typed. */
export function mockIdentityCorrectionRefused(
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> },
  status: number,
  viewer: unknown = ORGANIZATION_ADMIN,
  users: UserDto[] = USERS,
) {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: users })),
    http.patch(`${API_BASE_URL}/api/v1/users/:id`, () => HttpResponse.json({ error }, { status })),
  )
}

export function renderUsers(initialPath = '/users') {
  return renderApp(initialPath)
}
