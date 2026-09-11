import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import {
  ACTIVATION_TOKEN,
  findActivationHeading,
  mockAcceptance,
  mockPreview,
  mockSession,
  renderActivation,
  SIGNED_IN_ADMIN,
  submitActivation,
  VALID_PASSWORD,
} from './helpers'

const SIGNED_IN_NOTICE = `You're logged in as ${SIGNED_IN_ADMIN.firstName} ${SIGNED_IN_ADMIN.lastName}. Log out to continue with this activation.`

test('names the signed-in user and withholds the form', async () => {
  mockSession(SIGNED_IN_ADMIN)
  mockPreview()

  renderActivation()

  expect(await findActivationHeading()).toBeInTheDocument()
  expect(screen.getByText(/Claire Martin/)).toBeInTheDocument()
  expect(screen.getByText(SIGNED_IN_NOTICE)).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
})

test('offers the form on the same link once the signed-in user logs out', async () => {
  const user = userEvent.setup()
  mockSession(SIGNED_IN_ADMIN)
  mockPreview()

  const { router } = renderActivation()
  await screen.findByText(SIGNED_IN_NOTICE)
  await user.click(screen.getByRole('button', { name: 'Log out' }))

  expect(await screen.findByLabelText(/^Password/)).toBeInTheDocument()
  expect(screen.queryByText(SIGNED_IN_NOTICE)).not.toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/activate/${ACTIVATION_TOKEN}`)
})

test('treats a session confined to a password renewal as signed in, without redirecting it', async () => {
  const confined = { ...SIGNED_IN_ADMIN, passwordRenewalRequired: true }
  mockSession(confined)
  mockPreview()

  const { router } = renderActivation()

  expect(await screen.findByText(SIGNED_IN_NOTICE)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/activate/${ACTIVATION_TOKEN}`)
})

test('moves to the signed-in state when the API reports a session opened meanwhile', async () => {
  const user = userEvent.setup()
  const session = mockSession()
  mockPreview()
  mockAcceptance(() => {
    // Someone logged in from another tab while this screen was open.
    session.user = SIGNED_IN_ADMIN

    return HttpResponse.json(
      {
        error: {
          code: 'E_INVITATION_ACCEPTANCE_SESSION_OPEN',
          message: 'Log out before activating this access',
        },
      },
      { status: 409 },
    )
  })

  renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  expect(await screen.findByText(SIGNED_IN_NOTICE)).toBeInTheDocument()
  expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
})
