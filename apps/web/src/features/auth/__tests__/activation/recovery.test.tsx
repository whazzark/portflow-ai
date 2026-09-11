import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import {
  ACTIVATED_USER,
  findActivationHeading,
  mockAcceptance,
  mockPreview,
  mockSession,
  renderActivation,
  submitActivation,
  VALID_PASSWORD,
} from './helpers'

test('keeps the form and what was typed after a failure, and succeeds on a retry', async () => {
  const user = userEvent.setup()
  const session = mockSession()
  mockPreview()
  let attempt = 0
  mockAcceptance(() => {
    attempt += 1

    if (attempt === 1) {
      return HttpResponse.error()
    }

    session.user = ACTIVATED_USER

    return HttpResponse.json({ data: ACTIVATED_USER })
  })

  const { router } = renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  expect(
    await screen.findByText("We couldn't activate your access. Try again."),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toHaveValue(VALID_PASSWORD)
  expect(screen.getByLabelText(/^Confirm password/)).toHaveValue(VALID_PASSWORD)
  expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Activate' }))

  expect(await screen.findByText(ACTIVATED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})

test('says the access is active and points to login when no session could be opened', async () => {
  const user = userEvent.setup()
  mockSession()
  mockPreview()
  mockAcceptance(() =>
    HttpResponse.json(
      {
        error: {
          code: 'E_INVITATION_ACCEPTED_SESSION_NOT_OPENED',
          message: 'Your access is active. Log in with your new password',
        },
      },
      { status: 500 },
    ),
  )

  renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  expect(
    await screen.findByText('Your access is active. Log in with the password you just chose.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
})

test('offers to check the link again when it could not be checked', async () => {
  const user = userEvent.setup()
  mockSession()
  let attempt = 0
  mockPreview(() => {
    attempt += 1

    return attempt === 1
      ? HttpResponse.error()
      : HttpResponse.json({
          data: {
            firstName: ACTIVATED_USER.firstName,
            lastName: ACTIVATED_USER.lastName,
            email: ACTIVATED_USER.email,
          },
        })
  })

  renderActivation()

  expect(await screen.findByText("We couldn't check this activation link.")).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await findActivationHeading()).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toBeInTheDocument()
})
