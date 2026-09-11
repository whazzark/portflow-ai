import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ORGANIZATION_ADMIN, USERS_WITH_RESET } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockResetRefused, openRecordFor } from './helpers'

async function submitResetFor(user: ReturnType<typeof userEvent.setup>) {
  const record = await openRecordFor(user, 'Inès Joly')
  await user.click(within(record).getByRole('button', { name: 'Reset password' }))

  const confirmation = screen.getByRole('alertdialog')
  await user.click(within(confirmation).getByRole('button', { name: 'Reset password' }))

  return confirmation
}

test.each([
  [
    'a target that stopped being active',
    'E_USER_NOT_ACTIVE',
    "Only an active user's password can be reset",
    409,
    /no longer active/i,
  ],
  [
    'a target that no longer exists',
    'E_USER_NOT_FOUND',
    'User not found',
    404,
    /no longer exists/i,
  ],
  [
    'a self-reset',
    'E_USER_PASSWORD_RESET_SELF',
    'An administrator cannot reset their own password',
    422,
    /cannot reset your own password/i,
  ],
  [
    'a viewer who may not reset',
    'E_AUTHORIZATION_FAILURE',
    'Access denied',
    403,
    /not allowed to reset a password/i,
  ],
])('reports %s with its own reason', async (_label, code, message, status, expected) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  mockResetRefused(code, message, status)

  renderUsers()
  await submitResetFor(user)

  expect(await screen.findByText(expected)).toBeInTheDocument()
})

test('keeps the confirmation open after a refusal so the reset can be retried', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  mockResetRefused('E_USER_NOT_ACTIVE', "Only an active user's password can be reset", 409)

  renderUsers()
  await submitResetFor(user)

  await screen.findByText(/no longer active/i)
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(
    within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reset password' }),
  ).toBeEnabled()
})

test('shows no outstanding renewal on the record after a refused reset', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  mockResetRefused('E_USER_NOT_ACTIVE', "Only an active user's password can be reset", 409)

  renderUsers()
  const confirmation = await submitResetFor(user)

  await screen.findByText(/no longer active/i)

  // Dismissed first: the confirmation is modal, so the record behind it is inert — and unreadable —
  // until it closes.
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())

  const record = screen.getByRole('dialog')
  expect(within(record).queryByText('Renewal required')).not.toBeInTheDocument()
})
