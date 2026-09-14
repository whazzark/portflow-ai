import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { expect, test } from 'vitest'

import { server } from '@/test/msw/server'

import {
  fill,
  findForm,
  mockRefusal,
  mockSession,
  OWN_PROFILE_URL,
  renderProfile,
  save,
} from './support'

const NEW_ADDRESS = 'camille.renard@portflow.test'

test('refuses blank names before sending anything', async () => {
  const { submissions } = mockSession()

  renderProfile()
  const form = await findForm()
  fill('First name', '   ')
  fill('Last name', '')
  save()

  expect(await within(form).findByText('First name is required.')).toBeInTheDocument()
  expect(within(form).getByText('Last name is required.')).toBeInTheDocument()
  expect(submissions).toHaveLength(0)
})

test('places a validation refusal on the field it names', async () => {
  mockSession()
  mockRefusal(422, 'E_VALIDATION_ERROR', 'Validation failure', [
    { field: 'lastName', message: 'The lastName field must not be greater than 255 characters' },
  ])

  renderProfile()
  const form = await findForm()
  fill('Last name', 'Renard')
  save()

  const lastName = within(form).getByLabelText(/Last name/)
  await waitFor(() =>
    expect(lastName).toHaveAccessibleDescription(
      'The lastName field must not be greater than 255 characters',
    ),
  )
  expect(lastName).toHaveValue('Renard')
})

test('reports an address already used on the email field, keeping the input', async () => {
  mockSession()
  mockRefusal(409, 'E_USER_EMAIL_CONFLICT', 'Email address is already used by another user')

  renderProfile()
  const form = await findForm()
  fill('First name', 'Camille')
  fill('Email', NEW_ADDRESS)
  fill('Current password', 'Password!234')
  save()

  // On the field itself, not as a message about the form: the address is what the user must change.
  const email = within(form).getByLabelText(/Email/)
  await waitFor(() =>
    expect(email).toHaveAccessibleDescription('Email address is already used by another user'),
  )
  expect(email).toHaveAttribute('aria-invalid', 'true')
  expect(screen.queryByText(/Unable to update/)).not.toBeInTheDocument()
  expect(within(form).getByLabelText(/First name/)).toHaveValue('Camille')
  expect(email).toHaveValue(NEW_ADDRESS)
  expect(within(form).getByLabelText(/Current password/)).toHaveValue('')
})

test('submits again on the first click once a refused value is corrected', async () => {
  const { submissions } = mockSession()
  server.use(
    http.patch(
      OWN_PROFILE_URL,
      () =>
        HttpResponse.json(
          {
            error: {
              code: 'E_USER_EMAIL_CONFLICT',
              message: 'Email address is already used by another user',
            },
          },
          { status: 409 },
        ),
      { once: true },
    ),
  )

  renderProfile()
  const form = await findForm()
  fill('Email', 'claire.taken@portflow.test')
  fill('Current password', 'Password!234')
  save()
  await waitFor(() =>
    expect(within(form).getByLabelText(/Email/)).toHaveAccessibleDescription(
      'Email address is already used by another user',
    ),
  )

  fill('Email', NEW_ADDRESS)
  fill('Current password', 'Password!234')
  save()

  await waitFor(() => expect(submissions).toHaveLength(1))
  expect(submissions[0].email).toBe(NEW_ADDRESS)
}, 15000)

test('reports a refusal of the identity as a whole in the form and a toast', async () => {
  mockSession()
  mockRefusal(
    422,
    'E_USER_IDENTITY_INVALID',
    'User identity must carry a first name, a last name, and an email address',
  )

  renderProfile()
  const form = await findForm()
  fill('First name', 'Camille')
  save()

  expect(
    await within(form).findByText(
      'User identity must carry a first name, a last name, and an email address',
    ),
  ).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText('Unable to update identity “Claire Martin”')).toBeInTheDocument(),
  )
  expect(within(form).getByLabelText(/First name/)).toHaveValue('Camille')
})
