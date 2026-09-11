import { screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  API_BASE_URL,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'

/**
 * The counterpart of the API guarantee: nothing here refreshes a role by hand. The session is a
 * query like any other, so when `auth.me` reports a new role the navigation follows it — no new
 * sign-in, and no session invalidation mechanism to maintain.
 */
const mockSessionReporting = (viewer: unknown, users: unknown[]) => {
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () => HttpResponse.json({ data: viewer })),
    http.get(`${API_BASE_URL}/api/v1/users`, () => HttpResponse.json({ data: users })),
  )
}

test('offers user administration while the session reports an administrator role', async () => {
  mockSessionReporting(ORGANIZATION_ADMIN, USERS)

  renderApp('/')

  expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument()
})

test('follows a demotion reported by the session, without a new sign-in', async () => {
  const observer = { ...OPERATIONS_ADMIN, role: 'OBSERVER' }
  mockSessionReporting(observer, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderApp('/')
  // Waited on a link every role sees, so the absence below is a rendered navigation, not an
  // unrendered one.
  await screen.findAllByRole('link', { name: 'Overview' })

  // An observer administers nobody: the entry point is simply not there.
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument())
})

test('follows a promotion reported by the session', async () => {
  const promoted = { ...OPERATIONS_ADMIN, role: 'ORGANIZATION_ADMIN' }
  mockSessionReporting(promoted, USERS)

  renderApp('/')

  expect(await screen.findByRole('link', { name: 'Users' })).toBeInTheDocument()
})
