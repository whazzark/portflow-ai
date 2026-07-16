import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'

test('redirects unauthenticated access to the protected frame to the login screen', async () => {
  const { router } = renderApp('/')

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})

test('renders the protected frame with navigation for an authenticated user', async () => {
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } }),
    ),
  )

  renderApp('/')

  const nav = await screen.findByRole('navigation')

  expect(nav).toHaveTextContent('active.user@portflow.test')
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
})

test('signs out from the protected frame and returns to the login screen', async () => {
  const user = userEvent.setup()
  let signedIn = true

  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      signedIn
        ? HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } })
        : HttpResponse.json(
            {
              error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
            },
            { status: 401 },
          ),
    ),
    http.post(`${API_BASE_URL}/auth/logout`, () => {
      signedIn = false
      return new HttpResponse(null, { status: 204 })
    }),
  )

  const { router } = renderApp('/')

  await screen.findByRole('navigation')
  await user.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
})
