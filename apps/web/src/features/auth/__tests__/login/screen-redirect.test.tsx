import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { ACTIVE_USER, API_BASE_URL, renderLogin, submitLogin } from './helpers'

test('redirects to home after logging in directly from the login screen', async () => {
  const user = userEvent.setup()
  let isLoggedIn = false
  server.use(
    http.get(`${API_BASE_URL}/auth/me`, () =>
      isLoggedIn
        ? HttpResponse.json({ data: ACTIVE_USER })
        : HttpResponse.json(
            {
              error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
            },
            { status: 401 },
          ),
    ),
    http.post(`${API_BASE_URL}/auth/login`, () => {
      isLoggedIn = true
      return HttpResponse.json({ data: ACTIVE_USER })
    }),
  )
  await renderLogin('/login')
  await submitLogin(user)
  expect(await screen.findByText(ACTIVE_USER.email)).toBeInTheDocument()
  expect(
    screen.queryByRole('heading', { name: 'Keep every handoff on track' }),
  ).not.toBeInTheDocument()
})
