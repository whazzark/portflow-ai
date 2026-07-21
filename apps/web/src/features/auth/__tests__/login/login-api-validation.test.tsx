import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE_URL, renderLogin, submitLogin } from './login-test-helpers'

test('shows API validation details on the corresponding field', async () => {
  const user = userEvent.setup()
  server.use(
    http.post(`${API_BASE_URL}/auth/login`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            details: [{ field: 'email', message: 'This email address is not allowed.' }],
            message: 'Validation failure',
          },
        },
        { status: 422 },
      ),
    ),
  )
  await renderLogin()
  await submitLogin(user)
  expect(await screen.findByText('Validation failure')).toBeInTheDocument()
  expect(screen.getByText('This email address is not allowed.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Email address/)).toHaveAttribute('aria-invalid', 'true')
})
