import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'

import {
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  RESET_USERS_WITHOUT_LIFECYCLE,
  RESETTABLE_USER,
  USERS_WITH_RESET,
} from '../support/fixtures'
import { mockUsers, renderUsers } from '../support/test-helpers'
import { mockResetSucceeds } from './helpers'

// The menu is portaled out of the table, so its items are queried from `screen` rather than through
// the row — which the directory re-renders underneath them.
const openRowMenu = async (name: string, table = 'Active users') => {
  await screen.findByRole('table', { name: table })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

test('offers the reset from an active row to an organization admin', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  await openRowMenu('Inès Joly')

  expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeInTheDocument()
})

test('resets a password from its row without opening the record', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  const calls = mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  await openRowMenu('Inès Joly')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reset password' }))

  // The confirmation is the one the record footer uses, naming the user and the consequence.
  const confirmation = await screen.findByRole('alertdialog')
  expect(within(confirmation).getByText(/Inès Joly/)).toBeInTheDocument()
  expect(calls).toHaveLength(0)
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Reset password' }))

  await waitFor(() => expect(calls).toEqual([RESETTABLE_USER.id]))
  expect(await screen.findByText(/must choose a new password/i)).toBeInTheDocument()
  // The record sheet was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('records nothing when the confirmation opened from a row is cancelled', async () => {
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)
  const calls = mockResetSucceeds(RESETTABLE_USER, ORGANIZATION_ADMIN)

  renderUsers()
  await openRowMenu('Inès Joly')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reset password' }))
  const confirmation = await screen.findByRole('alertdialog')
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))

  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(calls).toHaveLength(0)
})

test('offers no reset from a row to an operations admin', async () => {
  mockUsers(OPERATIONS_ADMIN, RESET_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await openRowMenu('Inès Joly')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reset password' })).not.toBeInTheDocument()
})

test('offers no reset on the administrator’s own row', async () => {
  const self = { ...RESETTABLE_USER, id: ORGANIZATION_ADMIN.id }
  mockUsers(
    ORGANIZATION_ADMIN,
    USERS_WITH_RESET.map((entry) => (entry.id === RESETTABLE_USER.id ? self : entry)),
  )

  renderUsers()
  await openRowMenu('Inès Joly')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reset password' })).not.toBeInTheDocument()
})

test.each([
  ['Pending', 'Chloé Durand'],
  ['Deactivated', 'David Évrard'],
  ['Cancelled', 'Élodie Fabre'],
])('offers no reset on a %s row', async (view, name) => {
  const user = userEvent.setup()
  mockUsers(ORGANIZATION_ADMIN, USERS_WITH_RESET)

  renderUsers()
  await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
  await openRowMenu(name, `${view} users`)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Reset password' })).not.toBeInTheDocument()
})
