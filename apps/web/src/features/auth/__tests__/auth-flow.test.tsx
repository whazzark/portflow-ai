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
