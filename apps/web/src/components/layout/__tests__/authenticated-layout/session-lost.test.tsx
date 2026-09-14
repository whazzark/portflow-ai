import { screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { tuyauQuery } from '@/libraries/tuyau/client'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
  role: 'ORGANIZATION_ADMIN',
  accessStatus: 'ACTIVE',
}

/**
 * A session can end while its page is open — the user was deactivated, or demoted and deactivated
 * in a collision (GH-29). The next `auth.me` answers 401. The frame used to render nothing and stay
 * put, because the failed refetch keeps the previous user in the cache: the route guard, which reads
 * that cache, still let the next navigation through. A bare redirect would loop for the same reason,
 * `_guest` bouncing the stale user straight back.
 */
test('sends a viewer whose session is lost mid-visit to sign-in instead of a blank frame', async () => {
  let sessionLost = false
  server.use(
    http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
      sessionLost
        ? HttpResponse.json(
            {
              error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
            },
            { status: 401 },
          )
        : HttpResponse.json({ data: ACTIVE_USER }),
    ),
  )

  const { queryClient, router } = renderApp('/')
  await screen.findByRole('navigation', { name: 'Primary' })

  sessionLost = true
  await queryClient.invalidateQueries({ queryKey: tuyauQuery.auth.me.queryKey() })

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'), { timeout: 5000 })
  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
}, 15000)
