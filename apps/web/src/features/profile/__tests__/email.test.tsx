import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { expect, test } from 'vitest'

import { fill, findForm, mockRefusal, mockSession, renderProfile, save } from './support'

const NEW_ADDRESS = 'camille.renard@portflow.test'

test('asks for the current password only while the address differs from the stored one', async () => {
  mockSession()

  renderProfile()
  const form = await findForm()
  expect(within(form).queryByLabelText(/Current password/)).not.toBeInTheDocument()

  fill('Email', NEW_ADDRESS)

  const password = await within(form).findByLabelText(/Current password/)
  expect(password).toHaveAttribute('type', 'password')
  expect(password).toHaveAttribute('autocomplete', 'current-password')
  expect(
    within(form).getByText(
      'Your email address is how you sign in. Confirm the change with your current password.',
    ),
  ).toBeInTheDocument()

  // The same mailbox in another casing is not a change of address.
  fill('Email', ' Claire.Martin@Portflow.test ')

  await waitFor(() =>
    expect(within(form).queryByLabelText(/Current password/)).not.toBeInTheDocument(),
  )
})

test('refuses to send an address change without the current password', async () => {
  const { submissions } = mockSession()

  renderProfile()
  const form = await findForm()
  fill('Email', NEW_ADDRESS)
  save()

  expect(
    await within(form).findByText('Enter your current password to change your email address.'),
  ).toBeInTheDocument()
  expect(submissions).toHaveLength(0)
})

test('reports an incorrect password on its field, empties it, and keeps the rest', async () => {
  mockSession()
  const { submissions } = mockRefusal(
    422,
    'E_CURRENT_PASSWORD_INCORRECT',
    'The current password is incorrect.',
  )

  renderProfile()
  const form = await findForm()
  fill('Last name', 'Renard')
  fill('Email', NEW_ADDRESS)
  fill('Current password', 'not-the-password')
  save()

  expect(await within(form).findByText('The current password is incorrect.')).toBeInTheDocument()
  expect(submissions).toEqual([
    {
      firstName: 'Claire',
      lastName: 'Renard',
      email: NEW_ADDRESS,
      currentPassword: 'not-the-password',
    },
  ])
  expect(within(form).getByLabelText(/Current password/)).toHaveValue('')
  expect(within(form).getByLabelText(/Email/)).toHaveValue(NEW_ADDRESS)
  expect(within(form).getByLabelText(/Last name/)).toHaveValue('Renard')
})

test('applies a confirmed address change and carries it to the session', async () => {
  const { submissions } = mockSession()

  renderProfile()
  const form = await findForm()
  fill('Email', NEW_ADDRESS)
  fill('Current password', 'Password!234')
  save()

  await waitFor(() =>
    expect(submissions).toEqual([
      {
        firstName: 'Claire',
        lastName: 'Martin',
        email: NEW_ADDRESS,
        currentPassword: 'Password!234',
      },
    ]),
  )
  expect(await screen.findByText('Identity “Claire Martin” updated')).toBeInTheDocument()
  await waitFor(() =>
    expect(within(form).queryByLabelText(/Current password/)).not.toBeInTheDocument(),
  )
  expect(screen.getAllByText(NEW_ADDRESS).length).toBeGreaterThan(0)
}, 15000)

/**
 * The order a browser produces: the address is typed and left — which validates the form on blur,
 * while the current password is still empty — then the password is typed, then the form is
 * submitted with a single click. The form's own validation state must not swallow that click.
 */
test('submits a confirmed address change on the first click', async () => {
  const { submissions } = mockSession()

  renderProfile()
  const form = await findForm()
  const email = within(form).getByLabelText(/Email/)
  fireEvent.change(email, { target: { value: 'sophie.martel@portflow.test' } })
  fireEvent.blur(email)
  fireEvent.change(await within(form).findByLabelText(/Current password/), {
    target: { value: 'Password!234' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(submissions).toHaveLength(1))
}, 15000)

test('asks for the current password on submission, not while the address is being left', async () => {
  mockSession()

  renderProfile()
  const form = await findForm()
  const email = within(form).getByLabelText(/Email/)
  fireEvent.change(email, { target: { value: 'sophie.martel@portflow.test' } })
  fireEvent.blur(email)

  const password = await within(form).findByLabelText(/Current password/)
  expect(password).not.toHaveAttribute('aria-invalid', 'true')
  expect(
    within(form).queryByText('Enter your current password to change your email address.'),
  ).not.toBeInTheDocument()
})
