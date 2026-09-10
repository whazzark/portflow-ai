import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import {
  ACTIVE_USERS_WITHOUT_LIFECYCLE,
  OPERATIONS_ADMIN,
  ORGANIZATION_ADMIN,
  USERS,
} from '../support/fixtures'
import { mockUsers, mockUsersWithDeactivation, renderUsers } from '../support/test-helpers'

// The menu is portaled out of the table, so its items are queried from `screen` rather than through
// the row — which the directory re-renders underneath them.
const openRowMenu = async (name: string, table = 'Active users') => {
  await screen.findByRole('table', { name: table })
  fireEvent.click(await screen.findByRole('button', { name: `Actions for ${name}` }))
  await screen.findByRole('menu')
}

const openStatusView = async (user: ReturnType<typeof userEvent.setup>, view: string) => {
  await user.click(await screen.findByRole('tab', { name: new RegExp(view) }))
}

test('offers consultation and the deactivation from an active row', async () => {
  mockUsersWithDeactivation()

  renderUsers()
  await openRowMenu('Amélie Bernard')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Deactivate' })).toBeInTheDocument()
})

test('deactivates a user from its row without opening the record', async () => {
  mockUsersWithDeactivation()

  renderUsers()
  await openRowMenu('Amélie Bernard')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }))

  // The confirmation is the one the record footer uses, down to the sentence it makes.
  const confirmation = await screen.findByRole('alertdialog')
  expect(
    within(confirmation).getByRole('heading', { name: 'Deactivate user?' }),
  ).toBeInTheDocument()
  expect(within(confirmation).getByText(/Amélie Bernard/)).toBeInTheDocument()
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Deactivate' }))

  expect(await screen.findByText('User “Amélie Bernard” deactivated')).toBeInTheDocument()
  // The record sheet was never opened: the row menu is enough on its own.
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('tab', { name: /Active \(1\)/ })).toBeInTheDocument())
})

test('opens the record from the menu', async () => {
  mockUsersWithDeactivation()

  renderUsers()
  await openRowMenu('Amélie Bernard')
  fireEvent.click(screen.getByRole('menuitem', { name: 'View' }))

  const record = await screen.findByRole('dialog')
  expect(within(record).getByText('amelie.bernard@portflow.test')).toBeInTheDocument()
})

test('leaves a viewer who is no organization admin with consultation only', async () => {
  mockUsers(OPERATIONS_ADMIN, ACTIVE_USERS_WITHOUT_LIFECYCLE)

  renderUsers()
  await openRowMenu('Amélie Bernard')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test('never offers it on the viewer own row', async () => {
  // The viewer *is* the row: an administrator does not retire their own access.
  mockUsersWithDeactivation({ ...ORGANIZATION_ADMIN, id: 'active-1' }, USERS)

  renderUsers()
  await openRowMenu('Amélie Bernard')

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument()
})

test.each([
  ['Pending', 'Chloé Durand'],
  ['Deactivated', 'David Évrard'],
  ['Cancelled', 'Élodie Fabre'],
])('does not offer it on a %s row', async (view, name) => {
  const user = userEvent.setup()
  mockUsersWithDeactivation()

  renderUsers()
  await openStatusView(user, view)
  await openRowMenu(name, `${view} users`)

  expect(screen.getByRole('menuitem', { name: 'View' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument()
})
