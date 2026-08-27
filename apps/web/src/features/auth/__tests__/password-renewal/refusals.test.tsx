import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  API_BASE_URL,
  findRenewalHeading,
  mockSession,
  submitRenewal,
  UNAUTHENTICATED_BODY,
  VALID_PASSWORD,
} from './helpers'

const RENEWAL_URL = `${API_BASE_URL}/api/v1/auth/password-renewal`

test('refuses a password shorter than the minimum on the password field', async () => {
  const user = userEvent.setup()
  mockSession('confined')

  renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, 'short-pass')

  expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^New password/)).toHaveAttribute('aria-invalid', 'true')
  // The step stays usable for another attempt.
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('refuses a mismatched confirmation on the confirmation field', async () => {
  const user = userEvent.setup()
  mockSession('confined')

  renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, VALID_PASSWORD, `${VALID_PASSWORD}-typo`)

  expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Confirm new password/)).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('refuses a password identical to the one being replaced, on the password field', async () => {
  const user = userEvent.setup()
  mockSession('confined')
  server.use(
    http.post(RENEWAL_URL, () =>
      HttpResponse.json(
        {
          error: {
            code: 'E_PASSWORD_RENEWAL_UNCHANGED',
            message: 'New password must be different from the current one',
          },
        },
        { status: 422 },
      ),
    ),
  )

  renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, VALID_PASSWORD)

  expect(
    await screen.findByText('New password must be different from the current one'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^New password/)).toHaveAttribute('aria-invalid', 'true')
  expect(await findRenewalHeading()).toBeInTheDocument()
})

test('returns the user to sign-in when the session expired during submission', async () => {
  const user = userEvent.setup()
  const session = mockSession('confined')
  server.use(
    http.post(RENEWAL_URL, () => {
      session.value = 'signed-out'
      return HttpResponse.json(UNAUTHENTICATED_BODY, { status: 401 })
    }),
  )

  const { router } = renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, VALID_PASSWORD)

  expect(
    await screen.findByRole('heading', { name: 'Keep every handoff on track' }),
  ).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/login')
})
