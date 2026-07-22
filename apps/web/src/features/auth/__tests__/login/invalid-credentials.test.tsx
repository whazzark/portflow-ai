import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, renderLogin, submitLogin } from './helpers'

test('shows a toast when credentials are invalid', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/api/v1/auth/login`, () =>
      HttpResponse.json(
        { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
        { status: 401 },
      ),
    ),
  )
  await renderLogin()
  await submitLogin(user, 'wrong-password')
  expect(await screen.findByText('Unable to log in')).toBeInTheDocument()
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
})
