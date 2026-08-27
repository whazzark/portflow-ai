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
  RENEWED_USER,
  submitRenewal,
  VALID_PASSWORD,
} from './helpers'

test('takes the user into the application when another submission already cleared the requirement', async () => {
  const user = userEvent.setup()
  const session = mockSession('confined')
  server.use(
    http.post(`${API_BASE_URL}/api/v1/auth/password-renewal`, () => {
      // Whoever got there first recorded the password and cleared the requirement; this submission
      // matched zero rows. Nothing is left to do, so the screen must not report a failed save.
      session.value = 'renewed'
      return HttpResponse.json(
        {
          error: {
            code: 'E_PASSWORD_RENEWAL_NOT_REQUIRED',
            message: 'No password renewal is required for this account',
          },
        },
        { status: 409 },
      )
    }),
  )

  const { router } = renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, VALID_PASSWORD)

  expect(await screen.findByText(RENEWED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(screen.queryByText('Unable to save your new password')).not.toBeInTheDocument()
})
