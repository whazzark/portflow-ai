import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import { ORGANIZATION_ADMIN, RESETTABLE_USER, USERS_WITH_RESET } from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockResetSucceeds, openRecordFor } from './helpers'

async function openConfirmationFor(user: ReturnType<typeof userEvent.setup>) {
  const record = await openRecordFor(user, 'Inès Joly')
  await user.click(within(record).getByRole('button', { name: 'Reset password' }))

  return screen.getByRole('alertdialog')
}

test('names the user and states the consequence before anything is submitted', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  const calls = mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  const confirmation = await openConfirmationFor(user)

  expect(within(confirmation).getByText(/Inès Joly/)).toBeInTheDocument()
  expect(within(confirmation).getByText(/choose a new password/i)).toBeInTheDocument()
  expect(calls).toHaveLength(0)
})

test('records nothing when the confirmation is cancelled', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  const calls = mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  const confirmation = await openConfirmationFor(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(calls).toHaveLength(0)
})

test('submits the reset for the user named in the confirmation', async () => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  const calls = mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  const confirmation = await openConfirmationFor(user)
  await user.click(within(confirmation).getByRole('button', { name: 'Reset password' }))

  await waitFor(() => expect(calls).toEqual([RESETTABLE_USER.id]))
})
