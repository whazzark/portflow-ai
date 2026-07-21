import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'
const ACTIVE_USER = {
  id: 1,
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'active.user@portflow.test',
}

test('restores an authenticated session on load', async () => {
  server.use(http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })))

  renderApp('/')

  expect(await screen.findByText(ACTIVE_USER.email, {}, { timeout: 3_000 })).toBeInTheDocument()
})

test('shows the login screen when there is no valid session', async () => {
  renderApp('/')

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }, { timeout: 3_000 }),
  ).toBeInTheDocument()
})

test('redirects an authenticated user away from the login screen', async () => {
  server.use(http.get(`${API_BASE_URL}/auth/me`, () => HttpResponse.json({ data: ACTIVE_USER })))

  renderApp('/login')

  expect(await screen.findByText(ACTIVE_USER.email)).toBeInTheDocument()
})

test('shows a distinct error when session restoration fails for a reason other than being unauthenticated', async () => {
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Internal server error' } },
        { status: 500 },
      ),
    ),
  )

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
  expect(
    screen.queryByRole('heading', { name: 'Keep every handoff on track' }),
  ).not.toBeInTheDocument()
})

test('shares one auth.me cache entry across / and /login while authenticated', async () => {
  let meRequestCount = 0

  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () => {
      meRequestCount += 1
      return HttpResponse.json({ data: ACTIVE_USER })
    }),
  )

  const { router } = renderApp('/')

  await screen.findByText(ACTIVE_USER.email)
  const countAfterHome = meRequestCount

  await router.navigate({ to: '/login' })

  expect(await screen.findByText(ACTIVE_USER.email)).toBeInTheDocument()
  expect(meRequestCount).toBe(countAfterHome)
})
