import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'

const API_BASE_URL = 'http://localhost:3333'

test('restores an authenticated session on load', async () => {
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        data: { id: 1, email: 'active.user@portflow.test' },
      }),
    ),
  )

  renderApp('/')

  expect(await screen.findByText('active.user@portflow.test')).toBeInTheDocument()
})

test('shows the login screen when there is no valid session', async () => {
  renderApp('/')

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
})

test('redirects an authenticated user away from the login screen', async () => {
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json({
        data: { id: 1, email: 'active.user@portflow.test' },
      }),
    ),
  )

  renderApp('/login')

  expect(await screen.findByText('active.user@portflow.test')).toBeInTheDocument()
})

test('signs in with valid credentials', async () => {
  const user = userEvent.setup()
  let signedIn = false

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
    http.post(`${API_BASE_URL}/auth/login`, () => {
      signedIn = true
      return HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } })
    }),
  )

  renderApp('/')

  await screen.findByRole('heading', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email'), 'active.user@portflow.test')
  await user.type(screen.getByLabelText('Password'), 'Password!234')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('active.user@portflow.test')).toBeInTheDocument()
})

test('shows an error message when credentials are invalid', async () => {
  const user = userEvent.setup()

  server.use(
    http.post(`${API_BASE_URL}/auth/login`, () =>
      HttpResponse.json(
        { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 },
      ),
    ),
  )

  renderApp('/')

  await screen.findByRole('heading', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email'), 'active.user@portflow.test')
  await user.type(screen.getByLabelText('Password'), 'wrong-password')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
})

test('redirects to home after signing in directly from the login screen', async () => {
  const user = userEvent.setup()
  let signedIn = false

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
    http.post(`${API_BASE_URL}/auth/login`, () => {
      signedIn = true
      return HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } })
    }),
  )

  renderApp('/login')

  await screen.findByRole('heading', { name: 'Sign in' })
  await user.type(screen.getByLabelText('Email'), 'active.user@portflow.test')
  await user.type(screen.getByLabelText('Password'), 'Password!234')
  await user.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText('active.user@portflow.test')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
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
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
})

test('shows an error when signing out fails', async () => {
  const user = userEvent.setup()

  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } }),
    ),
    http.post(`${API_BASE_URL}/auth/logout`, () =>
      HttpResponse.json(
        { error: { code: 'E_INTERNAL_SERVER_ERROR', message: 'Internal server error' } },
        { status: 500 },
      ),
    ),
  )

  renderApp('/')

  await screen.findByText('active.user@portflow.test')
  await user.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
  expect(screen.getByText('active.user@portflow.test')).toBeInTheDocument()
})

test('shares one auth.me cache entry across / and /login while authenticated', async () => {
  let meRequestCount = 0

  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () => {
      meRequestCount += 1
      return HttpResponse.json({ data: { id: 1, email: 'active.user@portflow.test' } })
    }),
  )

  const { router } = renderApp('/')

  await screen.findByText('active.user@portflow.test')
  const countAfterHome = meRequestCount

  await router.navigate({ to: '/login' })

  expect(await screen.findByText('active.user@portflow.test')).toBeInTheDocument()
  expect(meRequestCount).toBe(countAfterHome)
})

test('signs out and returns to the login screen', async () => {
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

  renderApp('/')

  await screen.findByText('active.user@portflow.test')
  await user.click(screen.getByRole('button', { name: 'Sign out' }))

  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
})
