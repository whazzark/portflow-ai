import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'
import { server } from '@/test/msw/server'
import { renderApp } from '@/test/render-app'
import {
  API_BASE_URL,
  CONFINED_USER,
  findRenewalHeading,
  mockSession,
  RENEWED_USER,
  submitRenewal,
  VALID_PASSWORD,
} from './helpers'

test('presents the renewal step instead of the application, with no navigation around it', async () => {
  mockSession('confined')

  renderApp('/')

  expect(await findRenewalHeading()).toBeInTheDocument()
  expect(
    screen.getByText(
      'You must choose a new password before you can use Portflow. This replaces the password you signed in with.',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.queryByText(CONFINED_USER.email)).not.toBeInTheDocument()
})

test('reaches the application in the same session after a valid renewal', async () => {
  const user = userEvent.setup()
  const session = mockSession('confined')
  server.use(
    http.post(`${API_BASE_URL}/api/v1/auth/password-renewal`, async ({ request }) => {
      expect(await request.json()).toEqual({
        password: VALID_PASSWORD,
        passwordConfirmation: VALID_PASSWORD,
      })
      session.value = 'renewed'
      return HttpResponse.json({ data: RENEWED_USER })
    }),
  )

  const { router } = renderApp('/')
  await findRenewalHeading()
  await submitRenewal(user, VALID_PASSWORD)

  expect(await screen.findByText(RENEWED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
  expect(screen.queryByRole('heading', { name: 'Choose a new password' })).not.toBeInTheDocument()
})
