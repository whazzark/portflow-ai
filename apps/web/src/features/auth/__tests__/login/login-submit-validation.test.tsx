import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { ACTIVE_USER, API_BASE_URL, renderLogin } from './login-test-helpers'

test('validates untouched fields before submitting', async () => {
  const user = userEvent.setup()
  let loginRequestCount = 0
  server.use(
    http.post(`${API_BASE_URL}/auth/login`, () => {
      loginRequestCount += 1
      return HttpResponse.json({ data: ACTIVE_USER })
    }),
  )
  await renderLogin()
  await user.click(screen.getByRole('button', { name: 'Log in' }))
  expect(screen.getByLabelText(/^Email address/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByText('Password is required.')).toBeInTheDocument()
  expect(loginRequestCount).toBe(0)
})
