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

test('warns about a password shorter than the minimum as soon as the field is left', async () => {
  const user = userEvent.setup()
  mockSession()
  mockPreview()

  renderActivation()
  await findActivationHeading()
  await user.type(screen.getByLabelText(/^Password/), 'short-pass')
  await user.tab()

  expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toHaveAttribute('aria-invalid', 'true')
})

test('refuses a mismatched confirmation on the confirmation field, without calling the API', async () => {
  const user = userEvent.setup()
  mockSession()
  mockPreview()
  let acceptanceCalls = 0
  mockAcceptance(() => {
    acceptanceCalls += 1

    return HttpResponse.json({ data: ACTIVATED_USER })
  })

  renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD, `${VALID_PASSWORD}-typo`)

  expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Confirm password/)).toHaveAttribute('aria-invalid', 'true')
  expect(acceptanceCalls).toBe(0)
})

test('places an API refusal on its field, keeps what was typed, and succeeds once corrected', async () => {
  const user = userEvent.setup()
  const session = mockSession()
  mockPreview()
  let attempt = 0
  mockAcceptance(() => {
    attempt += 1

    if (attempt === 1) {
      return HttpResponse.json(
        {
          error: {
            code: 'E_VALIDATION_ERROR',
            message: 'Validation failure',
            details: [
              {
                field: 'password',
                message: 'The password field must not be greater than 128 characters',
                rule: 'maxLength',
              },
            ],
          },
        },
        { status: 422 },
      )
    }

    session.user = ACTIVATED_USER

    return HttpResponse.json({ data: ACTIVATED_USER })
  })

  const { router } = renderActivation()
  await findActivationHeading()
  await submitActivation(user, VALID_PASSWORD)

  expect(
    await screen.findByText('The password field must not be greater than 128 characters'),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/^Password/)).toHaveValue(VALID_PASSWORD)
  expect(screen.getByLabelText(/^Confirm password/)).toHaveValue(VALID_PASSWORD)

  await submitActivation(user, `${VALID_PASSWORD}-corrected`)

  expect(await screen.findByText(ACTIVATED_USER.email)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/')
})
