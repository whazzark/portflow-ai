import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'

import {
  ME_URL,
  mockPasswordChange,
  mockPasswordRefusal,
  mockSession,
  OWN_PASSWORD_URL,
  renderProfile,
  SESSION_USER,
} from './support'

const CURRENT = 'Password!234'
const NEW = 'correct-horse-battery-staple'

async function findPasswordForm() {
  await screen.findByRole('heading', { name: 'Password' }, { timeout: 5000 })

  return screen.getByRole('form', { name: 'Password' })
}

/**
 * Anchored, because "New password" is a prefix of "Confirm new password".
 *
 * Typing then leaving the field, as a keyboard does: the blur is what re-validates, and a form left
 * un-revalidated after a refusal swallows the next click on the button.
 */
const fillPassword = (label: RegExp, value: string) => {
  const field = screen.getByLabelText(label)
  fireEvent.change(field, { target: { value } })
  fireEvent.blur(field)
}

const CURRENT_FIELD = /^Current password/
const NEW_FIELD = /^New password/
const CONFIRM_FIELD = /^Confirm new password/

const changePassword = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))

test('is offered on the profile page, beside the identity', async () => {
  mockSession()

  renderProfile()
  const form = await findPasswordForm()

  expect(within(form).getByLabelText(CURRENT_FIELD)).toHaveAttribute('type', 'password')
  expect(within(form).getByLabelText(NEW_FIELD)).toHaveAttribute('autocomplete', 'new-password')
  expect(within(form).getByLabelText(CONFIRM_FIELD)).toBeInTheDocument()
  // The identity form is still there, on the same page.
  expect(screen.getByRole('form', { name: 'Identity' })).toBeInTheDocument()
})

test('sends the current and the new password, then empties the form', async () => {
  mockSession()
  const { submissions } = mockPasswordChange()

  renderProfile()
  const form = await findPasswordForm()
  fillPassword(CURRENT_FIELD, CURRENT)
  fillPassword(NEW_FIELD, NEW)
  fillPassword(CONFIRM_FIELD, NEW)
  changePassword()

  await waitFor(() =>
    expect(submissions).toEqual([
      { currentPassword: CURRENT, password: NEW, passwordConfirmation: NEW },
    ]),
  )
  expect(await screen.findByText('Password changed')).toBeInTheDocument()
  await waitFor(() => expect(within(form).getByLabelText(CURRENT_FIELD)).toHaveValue(''))
  expect(within(form).getByLabelText(NEW_FIELD)).toHaveValue('')
  expect(within(form).getByLabelText(CONFIRM_FIELD)).toHaveValue('')
})

test('refuses a short password and a mismatched confirmation without sending anything', async () => {
  mockSession()
  const { submissions } = mockPasswordChange()

  renderProfile()
  const form = await findPasswordForm()
  fillPassword(CURRENT_FIELD, CURRENT)
  fillPassword(NEW_FIELD, 'short')
  fillPassword(CONFIRM_FIELD, 'short')
  changePassword()

  expect(
    await within(form).findByText('Password must be at least 12 characters.'),
  ).toBeInTheDocument()

  fillPassword(NEW_FIELD, NEW)
  fillPassword(CONFIRM_FIELD, 'something-else-entirely')
  changePassword()

  expect(await within(form).findByText('Passwords do not match.')).toBeInTheDocument()
  expect(submissions).toHaveLength(0)
})

test('reports an incorrect current password on its field, and empties it', async () => {
  mockSession()
  mockPasswordRefusal(422, 'E_CURRENT_PASSWORD_INCORRECT', 'The current password is incorrect.')

  renderProfile()
  const form = await findPasswordForm()
  fillPassword(CURRENT_FIELD, 'not-the-password')
  fillPassword(NEW_FIELD, NEW)
  fillPassword(CONFIRM_FIELD, NEW)
  changePassword()

  const current = within(form).getByLabelText(CURRENT_FIELD)
  await waitFor(() =>
    expect(current).toHaveAccessibleDescription('The current password is incorrect.'),
  )
  expect(current).toHaveValue('')
  // What is not the credential at fault survives, so the attempt can be made again.
  expect(within(form).getByLabelText(NEW_FIELD)).toHaveValue(NEW)
})

test('reports a new password identical to the current one on the new password field', async () => {
  mockSession()
  mockPasswordRefusal(
    422,
    'E_PASSWORD_UNCHANGED',
    'New password must be different from the current one.',
  )

  renderProfile()
  const form = await findPasswordForm()
  fillPassword(CURRENT_FIELD, CURRENT)
  fillPassword(NEW_FIELD, CURRENT)
  fillPassword(CONFIRM_FIELD, CURRENT)
  changePassword()

  await waitFor(() =>
    expect(within(form).getByLabelText(NEW_FIELD)).toHaveAccessibleDescription(
      'New password must be different from the current one.',
    ),
  )
})

test('hands an ended session over to sign-in rather than reporting it in the form', async () => {
  const state = { ended: false }
  server.use(
    http.get(ME_URL, () =>
      state.ended
        ? HttpResponse.json(
            {
              error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' },
            },
            { status: 401 },
          )
        : HttpResponse.json({ data: SESSION_USER }),
    ),
    http.patch(OWN_PASSWORD_URL, () => {
      state.ended = true

      return HttpResponse.json(
        { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Unauthorized access' } },
        { status: 401 },
      )
    }),
  )

  const { router } = renderProfile()
  await findPasswordForm()
  fillPassword(CURRENT_FIELD, CURRENT)
  fillPassword(NEW_FIELD, NEW)
  fillPassword(CONFIRM_FIELD, NEW)
  changePassword()

  await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
})
