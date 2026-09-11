import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { expect, test } from 'vitest'
import {
  findActivationHeading,
  mockAcceptance,
  mockPreview,
  mockSession,
  PREVIEW,
  renderActivation,
  submitActivation,
  UNUSABLE_LINK_BODY,
  VALID_PASSWORD,
} from './helpers'

async function expectUnusableState() {
  expect(
    await screen.findByRole('heading', { name: "This activation link can't be used" }),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      "If you've already activated your access, log in with your password. Otherwise, ask an organization admin for a new link.",
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  expect(screen.queryByLabelText(/^Password/)).not.toBeInTheDocument()
  expect(screen.queryByText(new RegExp(PREVIEW.lastName))).not.toBeInTheDocument()
  expect(screen.queryByText(PREVIEW.email)).not.toBeInTheDocument()
}

test('shows the unusable state, with both next steps and no identity, for a dead link', async () => {
  mockSession()
  mockPreview(() => HttpResponse.json(UNUSABLE_LINK_BODY, { status: 404 }))

  renderActivation()

  await expectUnusableState()
})

test('moves to the unusable state when the link dies between opening and submitting', async () => {
  const user = userEvent.setup()
  mockSession()
  mockPreview()
  mockAcceptance(() => HttpResponse.json(UNUSABLE_LINK_BODY, { status: 404 }))

  renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  await expectUnusableState()
})

test('treats a refusal naming the token itself as an unusable link', async () => {
  const user = userEvent.setup()
  mockSession()
  mockPreview()
  mockAcceptance(() =>
    HttpResponse.json(
      {
        error: {
          code: 'E_VALIDATION_ERROR',
          message: 'Validation failure',
          details: [
            { field: 'token', message: 'The token field must be defined', rule: 'required' },
          ],
        },
      },
      { status: 422 },
    ),
  )

  renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  await expectUnusableState()
})
